// Prototype Methods ///////////////////////////////////////////////////////////

var prototypeMethods = {};

prototypeMethods.getRelated = function(relationName) {
  var doc = this;
  var Class = doc.constructor;

  // If there is already a reference to the relation object(s) stored in the
  // "_references" object then we can take it without looking in collection.
  if (_.has(this._references, relationName)) {
    return this._references[relationName];
  }

  // Look for the relation definition.
  var relation = Class.getRelation(relationName);
  if (!relation) {
    return;
  }

  // Get a collection defined in the relation.
  var ForeignClass = Astro.getClass(relation.class);
  var ForeignCollection = ForeignClass.getCollection();

  // Prepare selector to select only these documents that much the relation.
  var selector = {};
  var localValue = this.get(relation.local);
  selector[relation.foreign] = _.isArray(localValue) ?
    {$in: localValue} : localValue;

  // Get a related object.
  var related;
  if (relation.type === 'one') {
    related = ForeignCollection.findOne(selector);
  } else if (relation.type === 'many') {
    related = ForeignCollection.find(selector);
  }

  // Assing the related object to the "_references" object for further use.
  return this._references[relationName] = related;
};

// Class Methods ///////////////////////////////////////////////////////////////

var classMethods = {};

classMethods.hasRelation = function(relationName) {
  return _.has(this.schema.relations, relationName);
};

classMethods.getRelation = function(relationName) {
  return this.schema.relations[relationName];
};

classMethods.getRelations = function() {
  return this.schema.relations;
};

// Class Events ////////////////////////////////////////////////////////////////

var classEvents = {};

classEvents.beforeInit = function() {
  var doc = this;

  doc._references = {};
};

classEvents.afterSave = function() {
  this._references = {};
};

// onInitDefinition ////////////////////////////////////////////////////////////

Astro.eventManager.on(
  'initDefinition', function onInitDefinitionRelations(schemaDefinition) {
    var Class = this;
    var schema = Class.schema;
    var relationsDefinitions = {};

    if (_.has(schemaDefinition, 'relations')) {
      if (!_.isObject(schemaDefinition.relations)) {
        throw new Error(
          'The relations definition in the "' + Class.getName +
          '" class has to be an object'
        );
      }

      _.each(schemaDefinition.relations, function(relation, relationName) {
        var relation;

        if (!_.isObject(relation)) {
          throw new Error(
            'The "' + relationName + '" relation definition in the "' +
            Class.getName + '" class has to be an object'
          );
        }

        if (relation.type !== 'one' && relation.type !== 'many') {
          throw new Error(
            'The relation type for the "' + relationName +
            '" relation in the "' + this.getName() +
            '" class should be "one" or "many"'
          );
        }

        relationsDefinitions[relationName] = relation;
      });
    }

    if (_.size(relationsDefinitions) > 0) {
      // Add relations to the schema.
      schema.relations = schema.relations || {};
      _.extend(schema.relations, relationsDefinitions);

      var methods = {};
      _.each(relationsDefinitions, function(relationDefinition, relationName) {
        methods[relationName] = function() {
          return this.getRelated(relationName);
        };
      });

      // Add events only if the class has any relations.
      Class.extend({
        events: classEvents,
        methods: methods
      });

      // Add methods to the class prototype if it has any relations.
      _.extend(Astro.BaseClass.prototype, prototypeMethods);

      // Add class methods to the class if it has any relations.
      _.extend(Class, classMethods);
    }
  }
);