import React, { Component } from 'react';
import MultiSelect from '../../forms/form-fields/multi-select';
import { isEqual } from 'lodash/fp';

/**
 * Wrap the MultiSelect field in a HoC to implement the business logic that the available
 * categories are dictated by the selected dataDimensionType. This requires us to reset the
 * categories value on the object.
 *
 * TODO(mark): This sort of logic might need to be implemented into d2. This would be a more logical place for it.
 */
class CategoriesForCategoryCombo extends Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            value: props.value,
            dataDimensionType: props.model.dataDimensionType,
        };
    }

    componentWillReceiveProps(newProps) {
        console.log(newProps.value.size);
        if (isEqual(this.state.dataDimensionType, newProps.model.dataDimensionType) === false) {
            // The source has changed so we need to reset the selected
            newProps.value.clear();

            this.setState({
                value: newProps.value,
                dataDimensionType: newProps.model.dataDimensionType,
            });
        }
    }

    render() {
        if (!this.props.model.dataDimensionType) {
            return (
                <div></div>
            );
        }

        return(
            <MultiSelect
                {...this.props}
                value={this.state.value}
                queryParamFilter={[`dataDimensionType:eq:${this.props.model.dataDimensionType}`]}
            />
        );
    }
}

export default new Map([
    ['categories', {
        component: CategoriesForCategoryCombo,
        fieldOptions: {},
    }],
]);
