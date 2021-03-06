import { Subject } from 'rx';
import log from 'loglevel';

import { config, getInstance as getD2 } from 'd2/lib/d2';
import Action from 'd2-ui/lib/action/Action';
import camelCaseToUnderscores from 'd2-utilizr/lib/camelCaseToUnderscores';

import detailsStore from './details.store';
import snackActions from '../Snackbar/snack.actions';
import listStore from './list.store';
import sharingStore from './sharing.store';
import translateStore from './translation-dialog/translationStore';
import orgUnitAssignmentDialogStore from './organisation-unit-dialog/organisationUnitDialogStore';
import compulsoryDataElementStore from './compulsory-data-elements-dialog/compulsoryDataElementStore';
import appStore from '../App/appStateStore';
import { goToRoute } from '../router-utils';

export const afterDeleteHook$ = new Subject();

const contextActions = Action.createActionsFromNames([
    'edit',
    'clone',
    'share',
    'delete',
    'details',
    'translate',
    'assignToOrgUnits',
    'compulsoryDataElements',
    'sectionForm',
    'dataEntryForm',
    'pdfDataSetForm',
    'preview',
    'runNow',
]);

const confirm = (message) => new Promise((resolve, reject) => {
    if (window.confirm(message)) {
        resolve();
    }
    reject();
});

// TODO: The action assumes that the appState actually has state
contextActions.edit
    .subscribe(action => {
        goToRoute([
            '/edit',
            appStore.state.sideBar.currentSection,
            action.data.modelDefinition.name,
            action.data.id,
        ].join('/'));
    });

// TODO: The action assumes that the appState actually has state
contextActions.clone
    .subscribe(action => {
        goToRoute([
            '/clone',
            appStore.state.sideBar.currentSection,
            action.data.modelDefinition.name,
            action.data.id,
        ].join('/'));
    });

contextActions.delete
    .subscribe(({ data: model }) => getD2()
        .then(d2 => {
            snackActions.show({
                message: [
                    d2.i18n.getTranslation(`confirm_delete_${camelCaseToUnderscores(model.modelDefinition.name)}`),
                    model.name,
                ].join(' '),
                action: 'confirm',
                onActionTouchTap: () => {
                    model.delete()
                        .then(() => {
                            // Remove deleted item from the listStore
                            if (listStore.getState() && listStore.getState().list) {
                                listStore.setState({
                                    pager: listStore.getState().pager,
                                    list: listStore.getState().list
                                        .filter(modelToCheck => modelToCheck.id !== model.id),
                                });
                            }

                            snackActions.show({
                                message: `${model.name} ${d2.i18n.getTranslation('was_deleted')}`,
                            });

                            // Fire the afterDeleteHook
                            afterDeleteHook$.onNext({
                                model,
                                modelType: model.modelDefinition.name,
                            });
                        })
                        .catch(response => {
                            log.warn(response);
                            snackActions.show({
                                message: response.message
                                    ? response.message
                                    : `${model.name} ${d2.i18n.getTranslation('was_not_deleted')}`,
                                action: 'ok',
                            });
                        });
                }
            })
        })
    );

contextActions.details
    .subscribe(({ data: model }) => {
        detailsStore.setState(model);
    });

contextActions.share
    .subscribe(async({ data: model }) => {
        const d2 = await getD2();
        const modelToShare = await d2.models[model.modelDefinition.name].get(model.id);

        sharingStore.setState({
            model: modelToShare,
            open: true,
        });
    });

contextActions.translate
    .subscribe(async({ data: model }) => {
        const d2 = await getD2();
        const modelToTranslate = await d2.models[model.modelDefinition.name].get(model.id);

        translateStore.setState({
            model: modelToTranslate,
            open: true,
        });
    });

contextActions.assignToOrgUnits
    .subscribe(async({ data: model }) => {
        const d2 = await getD2();
        const modelItem = await d2.models[model.modelDefinition.name].get(model.id);

        orgUnitAssignmentDialogStore.setState({
            model: modelItem,
            roots: appStore.getState().userOrganisationUnits.toArray(),
            open: true,
        });
    });

contextActions.compulsoryDataElements
    .subscribe(async ({ data: model }) => {
        const d2 = await getD2();
        const api = d2.Api.getApi();
        const getModelItem = () => d2.models[model.modelDefinition.name].get(model.id, {
            fields: [
                ':all',
                'id,dataSetElements[id,dataElement[id]]',
                'compulsoryDataElementOperands[id,dataElement[id],categoryOptionCombo[id]]'
            ].join(','),
        });
        const getDataElementOperands = () => api
            .get(
                'dataElementOperands',
                {
                    fields: 'dataElementId,optionComboId,displayName',
                    totals: false,
                    paging: false,
                    dataSet: model.id,
                }
            )
            .then(responseData => responseData.dataElementOperands);

        // Open dialog immediately so we can show a progress indicator
        compulsoryDataElementStore.setState({
            open: true,
            model: undefined,
            dataElementOperands: [],
        });

        const [modelItem, dataElementOperands] = await Promise.all([getModelItem(), getDataElementOperands()]);

        const dataSetDataElementIds = modelItem.dataSetElements
            .toArray()
            .map(dataSetElement => dataSetElement.dataElement.id);

        const dataElementOperandsForDataSet = dataElementOperands
            .filter(dataElementOperand => dataSetDataElementIds.indexOf(dataElementOperand.dataElementId) >= 0);

        compulsoryDataElementStore.setState({
            open: true,
            model: modelItem,
            dataElementOperands: dataElementOperandsForDataSet,
        });
    });

contextActions.sectionForm
    .subscribe(action => {
        goToRoute([
            '/edit',
            appStore.state.sideBar.currentSection,
            action.data.modelDefinition.name,
            action.data.id,
            'sections',
        ].join('/'));
    });

contextActions.dataEntryForm
    .subscribe(action => {
        goToRoute([
            '/edit',
            appStore.state.sideBar.currentSection,
            action.data.modelDefinition.name,
            action.data.id,
            'dataEntryForm',
        ].join('/'));
    });

contextActions.pdfDataSetForm
    .subscribe(({data: model, complete, error}) => {
        getD2()
            .then((d2) => {
                window.open(d2.Api.getApi().baseUrl + `/pdfForm/dataSet/${model.id}`);
            })
            .then(complete)
            .catch(error);
    });

contextActions.runNow
    .subscribe(({ data: model, complete: actionComplete, error: actionFailed }) => {
        getD2()
            .then(d2 => {
                d2.Api.getApi().post([model.modelDefinition.name, model.id, 'run'].join('/'));
                snackActions.show({ message: d2.i18n.getTranslation('report_queued_for_delivery') });
            })
            .then(actionComplete)
            .catch(err => {
                snackActions.show({ message: d2.i18n.getTranslation('failed_to_schedule_report'), action: 'ok' });
                actionFailed(err);
            });
    });

contextActions.preview
    .subscribe(({ data: model, complete: actionComplete, error: actionFailed }) => {
        getD2()
            .then(d2 => {
                window.open(`${d2.Api.getApi().baseUrl}/${[model.modelDefinition.name, model.id, 'render'].join('/')}`);
            })
            .then(actionComplete)
            .catch(err => {
                snackActions.show({ message: d2.i18n.getTranslation('failed_to_open_report_preview'), action: 'ok' });
                actionFailed(err);
            });
    });

export default contextActions;
