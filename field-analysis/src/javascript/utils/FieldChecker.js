Ext.define('Rally.technicalservices.ModelFieldChecker',{
    constructor: function(config){
        this.model = config.model;
    },
    _getCustomFields: function(model){
        var custom_fields = _.filter(model.getFields(), function (field) {
            if (field && field.attributeDefinition) {
                return field.attributeDefinition.Custom && !field.hidden;
            }
        });
        return custom_fields;
    },
    _getNonCustomFields: function(model){
        var whitelistFields = ['Project','Tags','Iteration','Release','Owner','Tester','SubmittedBy'];
        var dropdown_fields = _.filter(model.getFields(), function (field) {
            if (field && field.attributeDefinition) {
                if (!Ext.Array.contains(whitelistFields, field.name)){
                    return !field.attributeDefinition.ReadOnly && !field.hidden && !field.attributeDefinition.Custom;
                }
            }
        });
        return dropdown_fields;
    },
    fetchData: function(){
        var deferred = Ext.create('Deft.Deferred');

        var custom = this._getCustomFields(this.model),
            dropdown = this._getNonCustomFields(this.model),
            fields = custom.concat(dropdown);


        this._fetchWsapiRecords(this._getWsapiConfig(this.model, fields)).then({
            success: function(records){
                this.data = this._mungeModelRecords(records, custom, dropdown);
                this.recordCount = records.length;
                this.modelName = this.model.getName();
                deferred.resolve(this);
            },
            failure: function(msg){
                deferred.reject(msg);
            },
            scope: this
        });

        return deferred;
    },
    _mungeModelRecords: function(records, customFields, dropdownFields){
        var data = [],
            model = this.model,
            modelName;

        _.each(customFields, function(c){
            modelName = c.modelType;
            var vals = this._getFieldValues(records, c.name, c.attributeDefinition.Constrained);
            data.push({model: c.modelType, field: c, fieldName: c.name, fieldDisplayName: c.displayName, fieldType: c.attributeDefinition.AttributeType,  totalCount: vals.count, uniqueValues: vals.values});
        }, this);

        _.each(dropdownFields, function(c){
            var vals = this._getFieldValues(records, c.name, c.attributeDefinition.Constrained);
            data.push({model: c.modelType, field: c, fieldName: c.name, fieldDisplayName: c.displayName, fieldType: c.attributeDefinition.AttributeType,  totalCount: vals.count, uniqueValues: vals.values});
        }, this);


        return data;

    },
    _getFieldValues: function(records, fieldName, constrained){
        var vals = {},
            count = 0,
            fieldType = null,
            isConstrained = false;

        if (records && records.length > 0){
            fieldType = records[0].getField(fieldName) && records[0].getField(fieldName).attributeDefinition &&
                records[0].getField(fieldName).attributeDefinition.AttributeType;
            isConstrained = records[0].getField(fieldName).attributeDefinition.Constrained;
        }

        _.each(records, function(r){
            var val = r.get(fieldName);
            if (val && (Ext.isObject(val) || val.length > 0)){
                console.log('fieldType', fieldType, val);

                if (Ext.isEmpty(val)){
                    val = '';
                }

                if (Ext.isObject(val)){
                    val = val._refObjectName || val._tagsNameArray || [];
                }

                if (val && !Ext.isArray(val) && val.length > 0){
                    val = [val];
                }

                if (val.length > 0){
                    count++;
                    if (isConstrained){
                        _.each(val, function(mv){
                            if (!vals[mv]){
                                vals[mv] = 0;
                            }
                            vals[mv]++;
                        });
                    }
                }
            }

        });

        var values = [];
        if (constrained){
            values = _.map(vals, function(count, key){ return key + '  (' + count + ')'; });
        }
        return { count: count, values: values};

    },
    _getWsapiConfig: function(model, fields){

        var fetch = _.map(fields, function(f){ return f.name; });

        return {
            model: model,
            fetch: fetch,
            limit: 'Infinity'
        };
    },
    _fetchWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        Ext.create('Rally.data.wsapi.Store', config).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },
    _fetchAllowedValues: function(model, fieldName){
        var deferred = Ext.create('Deft.Deferred');

        model.getField(fieldName).getAllowedValueStore().load({
            callback: function(records, operation, success) {
                if (success){
                    var vals = _.map(records, function(r){ return r.get('StringValue'); });
                    deferred.resolve(vals);
                } else {
                    deferred.reject("_fetchAllowedValues ERROR");
                }
            },
            scope: this
        });
      return deferred;
    }

});
