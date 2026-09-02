export default {
  __version: '7.1.14',
  'hydrator-user_totp_recovery_code_6000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_3, user_4) {
    // compiled hydrator for entity UserTotpRecoveryCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_3, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_4, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.code_hash === null) {
        entity.code_hash = null;
      } else if (typeof data.code_hash !== 'undefined') {
        entity.code_hash = data.code_hash;
      }
      if (data.used === null) {
        entity.used = null;
      } else if (typeof data.used !== 'undefined') {
        entity.used = !!data.used;
      }
      if (data.used_at === null) {
        entity.used_at = null;
      } else if (typeof data.used_at !== 'undefined') {
        if (data.used_at instanceof Date) {
          entity.used_at = data.used_at;
        } else if (typeof data.used_at === 'number' || data.used_at.includes('+') || data.used_at.lastIndexOf('-') > 10 || data.used_at.endsWith('Z')) {
          entity.used_at = new Date(data.used_at);
        } else {
          entity.used_at = new Date(data.used_at + 'Z');
        }
      }
    }
  },
  'hydrator-user_totp_recovery_code_6000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_11, user_12) {
    // compiled hydrator for entity UserTotpRecoveryCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_11, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_12, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.code_hash === null) {
        entity.code_hash = null;
      } else if (typeof data.code_hash !== 'undefined') {
        entity.code_hash = data.code_hash;
      }
      if (data.used === null) {
        entity.used = null;
      } else if (typeof data.used !== 'undefined') {
        entity.used = !!data.used;
      }
      if (data.used_at === null) {
        entity.used_at = null;
      } else if (typeof data.used_at !== 'undefined') {
        if (data.used_at instanceof Date) {
          entity.used_at = data.used_at;
        } else if (typeof data.used_at === 'number' || data.used_at.includes('+') || data.used_at.lastIndexOf('-') > 10 || data.used_at.endsWith('Z')) {
          entity.used_at = new Date(data.used_at);
        } else {
          entity.used_at = new Date(data.used_at + 'Z');
        }
      }
    }
  },
  'comparator-user_totp_recovery_code_6000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity UserTotpRecoveryCodeEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.code_hash === null && last.code_hash === undefined) {
        diff.code_hash = current.code_hash;
      } else if (current.code_hash == null && last.code_hash == null) {

      } else if ((current.code_hash != null && last.code_hash == null) || (current.code_hash == null && last.code_hash != null)) {
        diff.code_hash = current.code_hash;
      } else if (last.code_hash !== current.code_hash) {
        diff.code_hash = current.code_hash;
      }

      if (current.used === null && last.used === undefined) {
        diff.used = current.used;
      } else if (current.used == null && last.used == null) {

      } else if ((current.used != null && last.used == null) || (current.used == null && last.used != null)) {
        diff.used = current.used;
      } else if (!compareBooleans(last.used, current.used)) {
        diff.used = current.used;
      }

      if (current.used_at === null && last.used_at === undefined) {
        diff.used_at = current.used_at;
      } else if (current.used_at == null && last.used_at == null) {

      } else if ((current.used_at != null && last.used_at == null) || (current.used_at == null && last.used_at != null)) {
        diff.used_at = current.used_at;
      } else if (last.used_at.valueOf() !== current.used_at.valueOf()) {
        diff.used_at = current.used_at;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_totp_recovery_code_6000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.code_hash !== 'undefined') {
        ret.code_hash = entity.code_hash;
      }

      if (typeof entity.used !== 'undefined') {
        ret.used = entity.used;
      }

      if (typeof entity.used_at !== 'undefined') {
        ret.used_at = clone(processDateProperty(entity.used_at));
      }

      return ret;
    }
  },
  'resultMapper-user_totp_recovery_code_6000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserTotpRecoveryCodeEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.code_hash !== 'undefined') {
        ret.code_hash = result.code_hash;
        mapped.code_hash = true;
      }
      if (typeof result.used !== 'undefined') {
        ret.used = result.used == null ? result.used : !!result.used;
        mapped.used = true;
      }
      if (typeof result.used_at !== 'undefined') {
        if (result.used_at == null || result.used_at instanceof Date) {
          ret.used_at = result.used_at;
        } else if (typeof result.used_at === 'bigint') {
          ret.used_at = parseDate(Number(result.used_at));
        } else if (typeof result.used_at === 'number' || result.used_at.includes('+') || result.used_at.lastIndexOf('-') > 10 || result.used_at.endsWith('Z')) {
          ret.used_at = parseDate(result.used_at);
        } else {
          ret.used_at = parseDate(result.used_at + 'Z');
        }
        mapped.used_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_totp_recovery_code_6000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserTotpRecoveryCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-user_totp_recovery_code_6000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserTotpRecoveryCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-user_totp_recovery_code_6000': function(isEntityOrRef) {
    // compiled pk getter for entity UserTotpRecoveryCodeEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-user_totp_recovery_code_6000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity UserTotpRecoveryCodeEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-user_totp_recovery_code_6000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity UserTotpRecoveryCodeEntity
    return function(entity) {
      const val_0 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_0);
    }
  },
  'hydrator-user_totp_5000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_21, user_22) {
    // compiled hydrator for entity UserTotpEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_21, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_22, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.secret === null) {
        entity.secret = null;
      } else if (typeof data.secret !== 'undefined') {
        entity.secret = data.secret;
      }
      if (data.verified === null) {
        entity.verified = null;
      } else if (typeof data.verified !== 'undefined') {
        entity.verified = !!data.verified;
      }
      if (data.recovery_confirmed === null) {
        entity.recovery_confirmed = null;
      } else if (typeof data.recovery_confirmed !== 'undefined') {
        entity.recovery_confirmed = !!data.recovery_confirmed;
      }
    }
  },
  'hydrator-user_totp_5000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_29, user_30) {
    // compiled hydrator for entity UserTotpEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_29, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_30, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.secret === null) {
        entity.secret = null;
      } else if (typeof data.secret !== 'undefined') {
        entity.secret = data.secret;
      }
      if (data.verified === null) {
        entity.verified = null;
      } else if (typeof data.verified !== 'undefined') {
        entity.verified = !!data.verified;
      }
      if (data.recovery_confirmed === null) {
        entity.recovery_confirmed = null;
      } else if (typeof data.recovery_confirmed !== 'undefined') {
        entity.recovery_confirmed = !!data.recovery_confirmed;
      }
    }
  },
  'comparator-user_totp_5000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity UserTotpEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.secret === null && last.secret === undefined) {
        diff.secret = current.secret;
      } else if (current.secret == null && last.secret == null) {

      } else if ((current.secret != null && last.secret == null) || (current.secret == null && last.secret != null)) {
        diff.secret = current.secret;
      } else if (last.secret !== current.secret) {
        diff.secret = current.secret;
      }

      if (current.verified === null && last.verified === undefined) {
        diff.verified = current.verified;
      } else if (current.verified == null && last.verified == null) {

      } else if ((current.verified != null && last.verified == null) || (current.verified == null && last.verified != null)) {
        diff.verified = current.verified;
      } else if (!compareBooleans(last.verified, current.verified)) {
        diff.verified = current.verified;
      }

      if (current.recovery_confirmed === null && last.recovery_confirmed === undefined) {
        diff.recovery_confirmed = current.recovery_confirmed;
      } else if (current.recovery_confirmed == null && last.recovery_confirmed == null) {

      } else if ((current.recovery_confirmed != null && last.recovery_confirmed == null) || (current.recovery_confirmed == null && last.recovery_confirmed != null)) {
        diff.recovery_confirmed = current.recovery_confirmed;
      } else if (!compareBooleans(last.recovery_confirmed, current.recovery_confirmed)) {
        diff.recovery_confirmed = current.recovery_confirmed;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_totp_5000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.secret !== 'undefined') {
        ret.secret = entity.secret;
      }

      if (typeof entity.verified !== 'undefined') {
        ret.verified = entity.verified;
      }

      if (typeof entity.recovery_confirmed !== 'undefined') {
        ret.recovery_confirmed = entity.recovery_confirmed;
      }

      return ret;
    }
  },
  'resultMapper-user_totp_5000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserTotpEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.secret !== 'undefined') {
        ret.secret = result.secret;
        mapped.secret = true;
      }
      if (typeof result.verified !== 'undefined') {
        ret.verified = result.verified == null ? result.verified : !!result.verified;
        mapped.verified = true;
      }
      if (typeof result.recovery_confirmed !== 'undefined') {
        ret.recovery_confirmed = result.recovery_confirmed == null ? result.recovery_confirmed : !!result.recovery_confirmed;
        mapped.recovery_confirmed = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_totp_5000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserTotpEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-user_totp_5000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserTotpEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-user_totp_5000': function(isEntityOrRef) {
    // compiled pk getter for entity UserTotpEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-user_totp_5000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity UserTotpEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-user_totp_5000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity UserTotpEntity
    return function(entity) {
      const val_1 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_1);
    }
  },
  'hydrator-user_terms_consent_19000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_39, user_40, terms_41, terms_42) {
    // compiled hydrator for entity UserTermsConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_39, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_40, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.terms === null) {
        entity.terms = null;
      } else if (typeof data.terms !== 'undefined') {
        if (isPrimaryKey(data.terms, true)) {
          entity.terms = factory.createReference(terms_41, data.terms, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.terms && typeof data.terms === 'object') {
          entity.terms = factory.create(terms_42, data.terms, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.termsVersion === null) {
        entity.termsVersion = null;
      } else if (typeof data.termsVersion !== 'undefined') {
        entity.termsVersion = data.termsVersion;
      }
      if (data.agreed === null) {
        entity.agreed = null;
      } else if (typeof data.agreed !== 'undefined') {
        entity.agreed = !!data.agreed;
      }
      if (data.consentType === null) {
        entity.consentType = null;
      } else if (typeof data.consentType !== 'undefined') {
        entity.consentType = data.consentType;
      }
      if (data.agreedAt === null) {
        entity.agreedAt = null;
      } else if (typeof data.agreedAt !== 'undefined') {
        if (data.agreedAt instanceof Date) {
          entity.agreedAt = data.agreedAt;
        } else if (typeof data.agreedAt === 'number' || data.agreedAt.includes('+') || data.agreedAt.lastIndexOf('-') > 10 || data.agreedAt.endsWith('Z')) {
          entity.agreedAt = new Date(data.agreedAt);
        } else {
          entity.agreedAt = new Date(data.agreedAt + 'Z');
        }
      }
    }
  },
  'hydrator-user_terms_consent_19000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_50, user_51, terms_52, terms_53) {
    // compiled hydrator for entity UserTermsConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_50, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_51, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.terms === null) {
        entity.terms = null;
      } else if (typeof data.terms !== 'undefined') {
        if (isPrimaryKey(data.terms, true)) {
          entity.terms = factory.createReference(terms_52, data.terms, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.terms && typeof data.terms === 'object') {
          entity.terms = factory.create(terms_53, data.terms, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.termsVersion === null) {
        entity.termsVersion = null;
      } else if (typeof data.termsVersion !== 'undefined') {
        entity.termsVersion = data.termsVersion;
      }
      if (data.agreed === null) {
        entity.agreed = null;
      } else if (typeof data.agreed !== 'undefined') {
        entity.agreed = !!data.agreed;
      }
      if (data.consentType === null) {
        entity.consentType = null;
      } else if (typeof data.consentType !== 'undefined') {
        entity.consentType = data.consentType;
      }
      if (data.agreedAt === null) {
        entity.agreedAt = null;
      } else if (typeof data.agreedAt !== 'undefined') {
        if (data.agreedAt instanceof Date) {
          entity.agreedAt = data.agreedAt;
        } else if (typeof data.agreedAt === 'number' || data.agreedAt.includes('+') || data.agreedAt.lastIndexOf('-') > 10 || data.agreedAt.endsWith('Z')) {
          entity.agreedAt = new Date(data.agreedAt);
        } else {
          entity.agreedAt = new Date(data.agreedAt + 'Z');
        }
      }
    }
  },
  'comparator-user_terms_consent_19000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity UserTermsConsentEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.terms === null && last.terms === undefined) {
        diff.terms = current.terms;
      } else if (current.terms == null && last.terms == null) {

      } else if ((current.terms != null && last.terms == null) || (current.terms == null && last.terms != null)) {
        diff.terms = current.terms;
      } else if (last.terms !== current.terms) {
        diff.terms = current.terms;
      }

      if (current.termsVersion === null && last.termsVersion === undefined) {
        diff.termsVersion = current.termsVersion;
      } else if (current.termsVersion == null && last.termsVersion == null) {

      } else if ((current.termsVersion != null && last.termsVersion == null) || (current.termsVersion == null && last.termsVersion != null)) {
        diff.termsVersion = current.termsVersion;
      } else if (last.termsVersion !== current.termsVersion) {
        diff.termsVersion = current.termsVersion;
      }

      if (current.agreed === null && last.agreed === undefined) {
        diff.agreed = current.agreed;
      } else if (current.agreed == null && last.agreed == null) {

      } else if ((current.agreed != null && last.agreed == null) || (current.agreed == null && last.agreed != null)) {
        diff.agreed = current.agreed;
      } else if (!compareBooleans(last.agreed, current.agreed)) {
        diff.agreed = current.agreed;
      }

      if (current.consentType === null && last.consentType === undefined) {
        diff.consentType = current.consentType;
      } else if (current.consentType == null && last.consentType == null) {

      } else if ((current.consentType != null && last.consentType == null) || (current.consentType == null && last.consentType != null)) {
        diff.consentType = current.consentType;
      } else if (last.consentType !== current.consentType) {
        diff.consentType = current.consentType;
      }

      if (current.agreedAt === null && last.agreedAt === undefined) {
        diff.agreedAt = current.agreedAt;
      } else if (current.agreedAt == null && last.agreedAt == null) {

      } else if ((current.agreedAt != null && last.agreedAt == null) || (current.agreedAt == null && last.agreedAt != null)) {
        diff.agreedAt = current.agreedAt;
      } else if (last.agreedAt.valueOf() !== current.agreedAt.valueOf()) {
        diff.agreedAt = current.agreedAt;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_terms_consent_19000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.terms !== 'undefined') {
        if (entity.terms === null) {
          ret.terms = null;
        } else if (entity.terms?.__helper.__identifier && !entity.terms.__helper.hasPrimaryKey()) {
          ret.terms = entity.terms?.__helper.__identifier;
        } else if (typeof entity.terms !== 'undefined') {
          ret.terms = toArray(entity.terms.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.termsVersion !== 'undefined') {
        ret.termsVersion = entity.termsVersion;
      }

      if (typeof entity.agreed !== 'undefined') {
        ret.agreed = entity.agreed;
      }

      if (typeof entity.consentType !== 'undefined') {
        ret.consentType = entity.consentType;
      }

      if (typeof entity.agreedAt !== 'undefined') {
        ret.agreedAt = clone(processDateProperty(entity.agreedAt));
      }

      return ret;
    }
  },
  'resultMapper-user_terms_consent_19000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserTermsConsentEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.terms_id !== 'undefined') {
        ret.terms = result.terms_id;
        mapped.terms_id = true;
      }
      if (typeof result.terms_version !== 'undefined') {
        ret.termsVersion = result.terms_version;
        mapped.terms_version = true;
      }
      if (typeof result.agreed !== 'undefined') {
        ret.agreed = result.agreed == null ? result.agreed : !!result.agreed;
        mapped.agreed = true;
      }
      if (typeof result.consent_type !== 'undefined') {
        ret.consentType = result.consent_type;
        mapped.consent_type = true;
      }
      if (typeof result.agreed_at !== 'undefined') {
        if (result.agreed_at == null || result.agreed_at instanceof Date) {
          ret.agreedAt = result.agreed_at;
        } else if (typeof result.agreed_at === 'bigint') {
          ret.agreedAt = parseDate(Number(result.agreed_at));
        } else if (typeof result.agreed_at === 'number' || result.agreed_at.includes('+') || result.agreed_at.lastIndexOf('-') > 10 || result.agreed_at.endsWith('Z')) {
          ret.agreedAt = parseDate(result.agreed_at);
        } else {
          ret.agreedAt = parseDate(result.agreed_at + 'Z');
        }
        mapped.agreed_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_terms_consent_19000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserTermsConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-user_terms_consent_19000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserTermsConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-user_terms_consent_19000': function(isEntityOrRef) {
    // compiled pk getter for entity UserTermsConsentEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-user_terms_consent_19000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity UserTermsConsentEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-user_terms_consent_19000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity UserTermsConsentEntity
    return function(entity) {
      const val_2 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_2);
    }
  },
  'hydrator-user_passkey_4000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_63, user_64, convertToJSValue_transports, convertToDatabaseValue_transports) {
    // compiled hydrator for entity UserPasskeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_63, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_64, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.credential_id === null) {
        entity.credential_id = null;
      } else if (typeof data.credential_id !== 'undefined') {
        entity.credential_id = data.credential_id;
      }
      if (data.public_key === null) {
        entity.public_key = null;
      } else if (typeof data.public_key !== 'undefined') {
        entity.public_key = data.public_key;
      }
      if (data.counter === null) {
        entity.counter = null;
      } else if (typeof data.counter !== 'undefined') {
        entity.counter = data.counter;
      }
      if (data.device_type === null) {
        entity.device_type = null;
      } else if (typeof data.device_type !== 'undefined') {
        entity.device_type = data.device_type;
      }
      if (data.backed_up === null) {
        entity.backed_up = null;
      } else if (typeof data.backed_up !== 'undefined') {
        entity.backed_up = !!data.backed_up;
      }
      if (data.transports === null) {
        entity.transports = null;
      } else if (typeof data.transports !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_transports(data.transports);
          data.transports = convertToDatabaseValue_transports(value);
          entity.transports = value;
        } else {
          entity.transports = data.transports;
        }
      }
      if (data.name === null) {
        entity.name = null;
      } else if (typeof data.name !== 'undefined') {
        entity.name = data.name;
      }
      if (data.aaguid === null) {
        entity.aaguid = null;
      } else if (typeof data.aaguid !== 'undefined') {
        entity.aaguid = data.aaguid;
      }
    }
  },
  'hydrator-user_passkey_4000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_76, user_77, convertToJSValue_transports, convertToDatabaseValue_transports) {
    // compiled hydrator for entity UserPasskeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_76, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_77, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.credential_id === null) {
        entity.credential_id = null;
      } else if (typeof data.credential_id !== 'undefined') {
        entity.credential_id = data.credential_id;
      }
      if (data.public_key === null) {
        entity.public_key = null;
      } else if (typeof data.public_key !== 'undefined') {
        entity.public_key = data.public_key;
      }
      if (data.counter === null) {
        entity.counter = null;
      } else if (typeof data.counter !== 'undefined') {
        entity.counter = data.counter;
      }
      if (data.device_type === null) {
        entity.device_type = null;
      } else if (typeof data.device_type !== 'undefined') {
        entity.device_type = data.device_type;
      }
      if (data.backed_up === null) {
        entity.backed_up = null;
      } else if (typeof data.backed_up !== 'undefined') {
        entity.backed_up = !!data.backed_up;
      }
      if (data.transports === null) {
        entity.transports = null;
      } else if (typeof data.transports !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_transports(data.transports);
          data.transports = convertToDatabaseValue_transports(value);
          entity.transports = value;
        } else {
          entity.transports = data.transports;
        }
      }
      if (data.name === null) {
        entity.name = null;
      } else if (typeof data.name !== 'undefined') {
        entity.name = data.name;
      }
      if (data.aaguid === null) {
        entity.aaguid = null;
      } else if (typeof data.aaguid !== 'undefined') {
        entity.aaguid = data.aaguid;
      }
    }
  },
  'comparator-user_passkey_4000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity UserPasskeyEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.credential_id === null && last.credential_id === undefined) {
        diff.credential_id = current.credential_id;
      } else if (current.credential_id == null && last.credential_id == null) {

      } else if ((current.credential_id != null && last.credential_id == null) || (current.credential_id == null && last.credential_id != null)) {
        diff.credential_id = current.credential_id;
      } else if (last.credential_id !== current.credential_id) {
        diff.credential_id = current.credential_id;
      }

      if (current.public_key === null && last.public_key === undefined) {
        diff.public_key = current.public_key;
      } else if (current.public_key == null && last.public_key == null) {

      } else if ((current.public_key != null && last.public_key == null) || (current.public_key == null && last.public_key != null)) {
        diff.public_key = current.public_key;
      } else if (!equals(last.public_key, current.public_key)) {
        diff.public_key = current.public_key;
      }

      if (current.counter === null && last.counter === undefined) {
        diff.counter = current.counter;
      } else if (current.counter == null && last.counter == null) {

      } else if ((current.counter != null && last.counter == null) || (current.counter == null && last.counter != null)) {
        diff.counter = current.counter;
      } else if (!equals(last.counter, current.counter)) {
        diff.counter = current.counter;
      }

      if (current.device_type === null && last.device_type === undefined) {
        diff.device_type = current.device_type;
      } else if (current.device_type == null && last.device_type == null) {

      } else if ((current.device_type != null && last.device_type == null) || (current.device_type == null && last.device_type != null)) {
        diff.device_type = current.device_type;
      } else if (last.device_type !== current.device_type) {
        diff.device_type = current.device_type;
      }

      if (current.backed_up === null && last.backed_up === undefined) {
        diff.backed_up = current.backed_up;
      } else if (current.backed_up == null && last.backed_up == null) {

      } else if ((current.backed_up != null && last.backed_up == null) || (current.backed_up == null && last.backed_up != null)) {
        diff.backed_up = current.backed_up;
      } else if (!compareBooleans(last.backed_up, current.backed_up)) {
        diff.backed_up = current.backed_up;
      }

      if (current.transports === null && last.transports === undefined) {
        diff.transports = current.transports;
      } else if (current.transports == null && last.transports == null) {

      } else if ((current.transports != null && last.transports == null) || (current.transports == null && last.transports != null)) {
        diff.transports = current.transports;
      } else if (!equals(last.transports, current.transports)) {
        diff.transports = current.transports;
      }

      if (current.name === null && last.name === undefined) {
        diff.name = current.name;
      } else if (current.name == null && last.name == null) {

      } else if ((current.name != null && last.name == null) || (current.name == null && last.name != null)) {
        diff.name = current.name;
      } else if (last.name !== current.name) {
        diff.name = current.name;
      }

      if (current.aaguid === null && last.aaguid === undefined) {
        diff.aaguid = current.aaguid;
      } else if (current.aaguid == null && last.aaguid == null) {

      } else if ((current.aaguid != null && last.aaguid == null) || (current.aaguid == null && last.aaguid != null)) {
        diff.aaguid = current.aaguid;
      } else if (last.aaguid !== current.aaguid) {
        diff.aaguid = current.aaguid;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_passkey_4000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier, convertToDatabaseValue_transports) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.credential_id !== 'undefined') {
        ret.credential_id = entity.credential_id;
      }

      if (typeof entity.public_key !== 'undefined') {
        ret.public_key = clone(entity.public_key);
      }

      if (typeof entity.counter !== 'undefined') {
        ret.counter = clone(entity.counter);
      }

      if (typeof entity.device_type !== 'undefined') {
        ret.device_type = entity.device_type;
      }

      if (typeof entity.backed_up !== 'undefined') {
        ret.backed_up = entity.backed_up;
      }

      if (typeof entity.transports !== 'undefined') {
        ret.transports = clone(convertToDatabaseValue_transports(entity.transports));
      }

      if (typeof entity.name !== 'undefined') {
        ret.name = entity.name;
      }

      if (typeof entity.aaguid !== 'undefined') {
        ret.aaguid = entity.aaguid;
      }

      return ret;
    }
  },
  'resultMapper-user_passkey_4000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserPasskeyEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.credential_id !== 'undefined') {
        ret.credential_id = result.credential_id;
        mapped.credential_id = true;
      }
      if (typeof result.public_key !== 'undefined') {
        ret.public_key = result.public_key;
        mapped.public_key = true;
      }
      if (typeof result.counter !== 'undefined') {
        ret.counter = result.counter;
        mapped.counter = true;
      }
      if (typeof result.device_type !== 'undefined') {
        ret.device_type = result.device_type;
        mapped.device_type = true;
      }
      if (typeof result.backed_up !== 'undefined') {
        ret.backed_up = result.backed_up == null ? result.backed_up : !!result.backed_up;
        mapped.backed_up = true;
      }
      if (typeof result.transports !== 'undefined') {
        ret.transports = result.transports;
        mapped.transports = true;
      }
      if (typeof result.name !== 'undefined') {
        ret.name = result.name;
        mapped.name = true;
      }
      if (typeof result.aaguid !== 'undefined') {
        ret.aaguid = result.aaguid;
        mapped.aaguid = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_passkey_4000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserPasskeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-user_passkey_4000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserPasskeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-user_passkey_4000': function(isEntityOrRef) {
    // compiled pk getter for entity UserPasskeyEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-user_passkey_4000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity UserPasskeyEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-user_passkey_4000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity UserPasskeyEntity
    return function(entity) {
      const val_3 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_3);
    }
  },
  'hydrator-user_oauth_3000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_91, user_92) {
    // compiled hydrator for entity UserOAuthEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          data.id = convertToDatabaseValue_id(value);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_91, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_92, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.provider_name === null) {
        entity.provider_name = null;
      } else if (typeof data.provider_name !== 'undefined') {
        entity.provider_name = data.provider_name;
      }
      if (data.provider_user_id === null) {
        entity.provider_user_id = null;
      } else if (typeof data.provider_user_id !== 'undefined') {
        entity.provider_user_id = data.provider_user_id;
      }
      if (data.access_token === null) {
        entity.access_token = null;
      } else if (typeof data.access_token !== 'undefined') {
        entity.access_token = data.access_token;
      }
      if (data.refresh_token === null) {
        entity.refresh_token = null;
      } else if (typeof data.refresh_token !== 'undefined') {
        entity.refresh_token = data.refresh_token;
      }
      if (data.expires_at === null) {
        entity.expires_at = null;
      } else if (typeof data.expires_at !== 'undefined') {
        if (data.expires_at instanceof Date) {
          entity.expires_at = data.expires_at;
        } else if (typeof data.expires_at === 'number' || data.expires_at.includes('+') || data.expires_at.lastIndexOf('-') > 10 || data.expires_at.endsWith('Z')) {
          entity.expires_at = new Date(data.expires_at);
        } else {
          entity.expires_at = new Date(data.expires_at + 'Z');
        }
      }
    }
  },
  'hydrator-user_oauth_3000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_101, user_102) {
    // compiled hydrator for entity UserOAuthEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          data.id = convertToDatabaseValue_id(value);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_101, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_102, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.provider_name === null) {
        entity.provider_name = null;
      } else if (typeof data.provider_name !== 'undefined') {
        entity.provider_name = data.provider_name;
      }
      if (data.provider_user_id === null) {
        entity.provider_user_id = null;
      } else if (typeof data.provider_user_id !== 'undefined') {
        entity.provider_user_id = data.provider_user_id;
      }
      if (data.access_token === null) {
        entity.access_token = null;
      } else if (typeof data.access_token !== 'undefined') {
        entity.access_token = data.access_token;
      }
      if (data.refresh_token === null) {
        entity.refresh_token = null;
      } else if (typeof data.refresh_token !== 'undefined') {
        entity.refresh_token = data.refresh_token;
      }
      if (data.expires_at === null) {
        entity.expires_at = null;
      } else if (typeof data.expires_at !== 'undefined') {
        if (data.expires_at instanceof Date) {
          entity.expires_at = data.expires_at;
        } else if (typeof data.expires_at === 'number' || data.expires_at.includes('+') || data.expires_at.lastIndexOf('-') > 10 || data.expires_at.endsWith('Z')) {
          entity.expires_at = new Date(data.expires_at);
        } else {
          entity.expires_at = new Date(data.expires_at + 'Z');
        }
      }
    }
  },
  'comparator-user_oauth_3000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals, compareValues_4) {
    // compiled comparator for entity UserOAuthEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (!compareValues_4(last.id, current.id)) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.provider_name === null && last.provider_name === undefined) {
        diff.provider_name = current.provider_name;
      } else if (current.provider_name == null && last.provider_name == null) {

      } else if ((current.provider_name != null && last.provider_name == null) || (current.provider_name == null && last.provider_name != null)) {
        diff.provider_name = current.provider_name;
      } else if (last.provider_name !== current.provider_name) {
        diff.provider_name = current.provider_name;
      }

      if (current.provider_user_id === null && last.provider_user_id === undefined) {
        diff.provider_user_id = current.provider_user_id;
      } else if (current.provider_user_id == null && last.provider_user_id == null) {

      } else if ((current.provider_user_id != null && last.provider_user_id == null) || (current.provider_user_id == null && last.provider_user_id != null)) {
        diff.provider_user_id = current.provider_user_id;
      } else if (last.provider_user_id !== current.provider_user_id) {
        diff.provider_user_id = current.provider_user_id;
      }

      if (current.access_token === null && last.access_token === undefined) {
        diff.access_token = current.access_token;
      } else if (current.access_token == null && last.access_token == null) {

      } else if ((current.access_token != null && last.access_token == null) || (current.access_token == null && last.access_token != null)) {
        diff.access_token = current.access_token;
      } else if (last.access_token !== current.access_token) {
        diff.access_token = current.access_token;
      }

      if (current.refresh_token === null && last.refresh_token === undefined) {
        diff.refresh_token = current.refresh_token;
      } else if (current.refresh_token == null && last.refresh_token == null) {

      } else if ((current.refresh_token != null && last.refresh_token == null) || (current.refresh_token == null && last.refresh_token != null)) {
        diff.refresh_token = current.refresh_token;
      } else if (last.refresh_token !== current.refresh_token) {
        diff.refresh_token = current.refresh_token;
      }

      if (current.expires_at === null && last.expires_at === undefined) {
        diff.expires_at = current.expires_at;
      } else if (current.expires_at == null && last.expires_at == null) {

      } else if ((current.expires_at != null && last.expires_at == null) || (current.expires_at == null && last.expires_at != null)) {
        diff.expires_at = current.expires_at;
      } else if (last.expires_at.valueOf() !== current.expires_at.valueOf()) {
        diff.expires_at = current.expires_at;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_oauth_3000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.provider_name !== 'undefined') {
        ret.provider_name = entity.provider_name;
      }

      if (typeof entity.provider_user_id !== 'undefined') {
        ret.provider_user_id = entity.provider_user_id;
      }

      if (typeof entity.access_token !== 'undefined') {
        ret.access_token = entity.access_token;
      }

      if (typeof entity.refresh_token !== 'undefined') {
        ret.refresh_token = entity.refresh_token;
      }

      if (typeof entity.expires_at !== 'undefined') {
        ret.expires_at = clone(processDateProperty(entity.expires_at));
      }

      return ret;
    }
  },
  'resultMapper-user_oauth_3000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserOAuthEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.provider_name !== 'undefined') {
        ret.provider_name = result.provider_name;
        mapped.provider_name = true;
      }
      if (typeof result.provider_user_id !== 'undefined') {
        ret.provider_user_id = result.provider_user_id;
        mapped.provider_user_id = true;
      }
      if (typeof result.access_token !== 'undefined') {
        ret.access_token = result.access_token;
        mapped.access_token = true;
      }
      if (typeof result.refresh_token !== 'undefined') {
        ret.refresh_token = result.refresh_token;
        mapped.refresh_token = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expires_at = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expires_at = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expires_at = parseDate(result.expires_at);
        } else {
          ret.expires_at = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_oauth_3000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserOAuthEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          data.id = convertToDatabaseValue_id(value);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-user_oauth_3000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserOAuthEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          data.id = convertToDatabaseValue_id(value);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-user_oauth_3000': function(isEntityOrRef) {
    // compiled pk getter for entity UserOAuthEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-user_oauth_3000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity UserOAuthEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-user_oauth_3000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity UserOAuthEntity
    return function(entity) {
      const val_5 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_5);
    }
  },
  'hydrator-user_7000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, user_oauth_119, user_passkey_120, user_totp_121, user_totp_recovery_code_122) {
    // compiled hydrator for entity UserEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.sub === null) {
        entity.sub = null;
      } else if (typeof data.sub !== 'undefined') {
        entity.sub = data.sub;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.email === null) {
        entity.email = null;
      } else if (typeof data.email !== 'undefined') {
        entity.email = data.email;
      }
      if (data.email_verified === null) {
        entity.email_verified = null;
      } else if (typeof data.email_verified !== 'undefined') {
        entity.email_verified = !!data.email_verified;
      }
      if (data.password_hash === null) {
        entity.password_hash = null;
      } else if (typeof data.password_hash !== 'undefined') {
        entity.password_hash = data.password_hash;
      }
      if (data.managed_by === null) {
        entity.managed_by = null;
      } else if (typeof data.managed_by !== 'undefined') {
        entity.managed_by = data.managed_by;
      }
      if (data.role === null) {
        entity.role = null;
      } else if (typeof data.role !== 'undefined') {
        entity.role = data.role;
      }
      if (data.deleted_at === null) {
        entity.deleted_at = null;
      } else if (typeof data.deleted_at !== 'undefined') {
        if (data.deleted_at instanceof Date) {
          entity.deleted_at = data.deleted_at;
        } else if (typeof data.deleted_at === 'number' || data.deleted_at.includes('+') || data.deleted_at.lastIndexOf('-') > 10 || data.deleted_at.endsWith('Z')) {
          entity.deleted_at = new Date(data.deleted_at);
        } else {
          entity.deleted_at = new Date(data.deleted_at + 'Z');
        }
      }
      const createCollectionItem_oauthAccounts = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_oauth_119, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_oauth_119, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.oauthAccounts && !Array.isArray(data.oauthAccounts) && typeof data.oauthAccounts === 'object') {
        data.oauthAccounts = [data.oauthAccounts];
      }
      if (Array.isArray(data.oauthAccounts)) {
        const items = data.oauthAccounts.map(value => createCollectionItem_oauthAccounts(value, entity));
        const coll = Collection.create(entity, 'oauthAccounts', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.oauthAccounts && data.oauthAccounts instanceof Collection) {
        entity.oauthAccounts = data.oauthAccounts;
      } else if (!entity.oauthAccounts) {
        const coll = Collection.create(entity, 'oauthAccounts', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_passkeys = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_passkey_120, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_passkey_120, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.passkeys && !Array.isArray(data.passkeys) && typeof data.passkeys === 'object') {
        data.passkeys = [data.passkeys];
      }
      if (Array.isArray(data.passkeys)) {
        const items = data.passkeys.map(value => createCollectionItem_passkeys(value, entity));
        const coll = Collection.create(entity, 'passkeys', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.passkeys && data.passkeys instanceof Collection) {
        entity.passkeys = data.passkeys;
      } else if (!entity.passkeys) {
        const coll = Collection.create(entity, 'passkeys', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_totps = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_totp_121, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_totp_121, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.totps && !Array.isArray(data.totps) && typeof data.totps === 'object') {
        data.totps = [data.totps];
      }
      if (Array.isArray(data.totps)) {
        const items = data.totps.map(value => createCollectionItem_totps(value, entity));
        const coll = Collection.create(entity, 'totps', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.totps && data.totps instanceof Collection) {
        entity.totps = data.totps;
      } else if (!entity.totps) {
        const coll = Collection.create(entity, 'totps', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_totpRecoveryCodes = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_totp_recovery_code_122, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_totp_recovery_code_122, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.totpRecoveryCodes && !Array.isArray(data.totpRecoveryCodes) && typeof data.totpRecoveryCodes === 'object') {
        data.totpRecoveryCodes = [data.totpRecoveryCodes];
      }
      if (Array.isArray(data.totpRecoveryCodes)) {
        const items = data.totpRecoveryCodes.map(value => createCollectionItem_totpRecoveryCodes(value, entity));
        const coll = Collection.create(entity, 'totpRecoveryCodes', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.totpRecoveryCodes && data.totpRecoveryCodes instanceof Collection) {
        entity.totpRecoveryCodes = data.totpRecoveryCodes;
      } else if (!entity.totpRecoveryCodes) {
        const coll = Collection.create(entity, 'totpRecoveryCodes', undefined, newEntity);
        coll.setDirty(false);
      }
    }
  },
  'hydrator-user_7000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, user_oauth_132, user_passkey_133, user_totp_134, user_totp_recovery_code_135) {
    // compiled hydrator for entity UserEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.sub === null) {
        entity.sub = null;
      } else if (typeof data.sub !== 'undefined') {
        entity.sub = data.sub;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.email === null) {
        entity.email = null;
      } else if (typeof data.email !== 'undefined') {
        entity.email = data.email;
      }
      if (data.email_verified === null) {
        entity.email_verified = null;
      } else if (typeof data.email_verified !== 'undefined') {
        entity.email_verified = !!data.email_verified;
      }
      if (data.password_hash === null) {
        entity.password_hash = null;
      } else if (typeof data.password_hash !== 'undefined') {
        entity.password_hash = data.password_hash;
      }
      if (data.managed_by === null) {
        entity.managed_by = null;
      } else if (typeof data.managed_by !== 'undefined') {
        entity.managed_by = data.managed_by;
      }
      if (data.role === null) {
        entity.role = null;
      } else if (typeof data.role !== 'undefined') {
        entity.role = data.role;
      }
      if (data.deleted_at === null) {
        entity.deleted_at = null;
      } else if (typeof data.deleted_at !== 'undefined') {
        if (data.deleted_at instanceof Date) {
          entity.deleted_at = data.deleted_at;
        } else if (typeof data.deleted_at === 'number' || data.deleted_at.includes('+') || data.deleted_at.lastIndexOf('-') > 10 || data.deleted_at.endsWith('Z')) {
          entity.deleted_at = new Date(data.deleted_at);
        } else {
          entity.deleted_at = new Date(data.deleted_at + 'Z');
        }
      }
      const createCollectionItem_oauthAccounts = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_oauth_132, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_oauth_132, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.oauthAccounts && !Array.isArray(data.oauthAccounts) && typeof data.oauthAccounts === 'object') {
        data.oauthAccounts = [data.oauthAccounts];
      }
      if (Array.isArray(data.oauthAccounts)) {
        const items = data.oauthAccounts.map(value => createCollectionItem_oauthAccounts(value, entity));
        const coll = Collection.create(entity, 'oauthAccounts', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.oauthAccounts && data.oauthAccounts instanceof Collection) {
        entity.oauthAccounts = data.oauthAccounts;
      } else if (!entity.oauthAccounts) {
        const coll = Collection.create(entity, 'oauthAccounts', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_passkeys = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_passkey_133, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_passkey_133, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.passkeys && !Array.isArray(data.passkeys) && typeof data.passkeys === 'object') {
        data.passkeys = [data.passkeys];
      }
      if (Array.isArray(data.passkeys)) {
        const items = data.passkeys.map(value => createCollectionItem_passkeys(value, entity));
        const coll = Collection.create(entity, 'passkeys', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.passkeys && data.passkeys instanceof Collection) {
        entity.passkeys = data.passkeys;
      } else if (!entity.passkeys) {
        const coll = Collection.create(entity, 'passkeys', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_totps = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_totp_134, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_totp_134, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.totps && !Array.isArray(data.totps) && typeof data.totps === 'object') {
        data.totps = [data.totps];
      }
      if (Array.isArray(data.totps)) {
        const items = data.totps.map(value => createCollectionItem_totps(value, entity));
        const coll = Collection.create(entity, 'totps', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.totps && data.totps instanceof Collection) {
        entity.totps = data.totps;
      } else if (!entity.totps) {
        const coll = Collection.create(entity, 'totps', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_totpRecoveryCodes = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_totp_recovery_code_135, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_totp_recovery_code_135, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.totpRecoveryCodes && !Array.isArray(data.totpRecoveryCodes) && typeof data.totpRecoveryCodes === 'object') {
        data.totpRecoveryCodes = [data.totpRecoveryCodes];
      }
      if (Array.isArray(data.totpRecoveryCodes)) {
        const items = data.totpRecoveryCodes.map(value => createCollectionItem_totpRecoveryCodes(value, entity));
        const coll = Collection.create(entity, 'totpRecoveryCodes', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.totpRecoveryCodes && data.totpRecoveryCodes instanceof Collection) {
        entity.totpRecoveryCodes = data.totpRecoveryCodes;
      } else if (!entity.totpRecoveryCodes) {
        const coll = Collection.create(entity, 'totpRecoveryCodes', undefined, newEntity);
        coll.setDirty(false);
      }
    }
  },
  'comparator-user_7000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity UserEntity
    return function(last, current, options) {
      const diff = {};
      if (current.sub === null && last.sub === undefined) {
        diff.sub = current.sub;
      } else if (current.sub == null && last.sub == null) {

      } else if ((current.sub != null && last.sub == null) || (current.sub == null && last.sub != null)) {
        diff.sub = current.sub;
      } else if (last.sub !== current.sub) {
        diff.sub = current.sub;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.email === null && last.email === undefined) {
        diff.email = current.email;
      } else if (current.email == null && last.email == null) {

      } else if ((current.email != null && last.email == null) || (current.email == null && last.email != null)) {
        diff.email = current.email;
      } else if (last.email !== current.email) {
        diff.email = current.email;
      }

      if (current.email_verified === null && last.email_verified === undefined) {
        diff.email_verified = current.email_verified;
      } else if (current.email_verified == null && last.email_verified == null) {

      } else if ((current.email_verified != null && last.email_verified == null) || (current.email_verified == null && last.email_verified != null)) {
        diff.email_verified = current.email_verified;
      } else if (!compareBooleans(last.email_verified, current.email_verified)) {
        diff.email_verified = current.email_verified;
      }

      if (current.password_hash === null && last.password_hash === undefined) {
        diff.password_hash = current.password_hash;
      } else if (current.password_hash == null && last.password_hash == null) {

      } else if ((current.password_hash != null && last.password_hash == null) || (current.password_hash == null && last.password_hash != null)) {
        diff.password_hash = current.password_hash;
      } else if (last.password_hash !== current.password_hash) {
        diff.password_hash = current.password_hash;
      }

      if (current.managed_by === null && last.managed_by === undefined) {
        diff.managed_by = current.managed_by;
      } else if (current.managed_by == null && last.managed_by == null) {

      } else if ((current.managed_by != null && last.managed_by == null) || (current.managed_by == null && last.managed_by != null)) {
        diff.managed_by = current.managed_by;
      } else if (last.managed_by !== current.managed_by) {
        diff.managed_by = current.managed_by;
      }

      if (current.role === null && last.role === undefined) {
        diff.role = current.role;
      } else if (current.role == null && last.role == null) {

      } else if ((current.role != null && last.role == null) || (current.role == null && last.role != null)) {
        diff.role = current.role;
      } else if (last.role !== current.role) {
        diff.role = current.role;
      }

      if (current.deleted_at === null && last.deleted_at === undefined) {
        diff.deleted_at = current.deleted_at;
      } else if (current.deleted_at == null && last.deleted_at == null) {

      } else if ((current.deleted_at != null && last.deleted_at == null) || (current.deleted_at == null && last.deleted_at != null)) {
        diff.deleted_at = current.deleted_at;
      } else if (last.deleted_at.valueOf() !== current.deleted_at.valueOf()) {
        diff.deleted_at = current.deleted_at;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_7000': function(clone, cloneEmbeddable, processDateProperty) {
    return function(entity) {
      const ret = {};
      if (typeof entity.sub !== 'undefined') {
        ret.sub = entity.sub;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.email !== 'undefined') {
        ret.email = entity.email;
      }

      if (typeof entity.email_verified !== 'undefined') {
        ret.email_verified = entity.email_verified;
      }

      if (typeof entity.password_hash !== 'undefined') {
        ret.password_hash = entity.password_hash;
      }

      if (typeof entity.managed_by !== 'undefined') {
        ret.managed_by = entity.managed_by;
      }

      if (typeof entity.role !== 'undefined') {
        ret.role = entity.role;
      }

      if (typeof entity.deleted_at !== 'undefined') {
        ret.deleted_at = clone(processDateProperty(entity.deleted_at));
      }

      return ret;
    }
  },
  'resultMapper-user_7000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.sub !== 'undefined') {
        ret.sub = result.sub;
        mapped.sub = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.email !== 'undefined') {
        ret.email = result.email;
        mapped.email = true;
      }
      if (typeof result.email_verified !== 'undefined') {
        ret.email_verified = result.email_verified == null ? result.email_verified : !!result.email_verified;
        mapped.email_verified = true;
      }
      if (typeof result.password_hash !== 'undefined') {
        ret.password_hash = result.password_hash;
        mapped.password_hash = true;
      }
      if (typeof result.managed_by !== 'undefined') {
        ret.managed_by = result.managed_by;
        mapped.managed_by = true;
      }
      if (typeof result.role !== 'undefined') {
        ret.role = result.role;
        mapped.role = true;
      }
      if (typeof result.deleted_at !== 'undefined') {
        if (result.deleted_at == null || result.deleted_at instanceof Date) {
          ret.deleted_at = result.deleted_at;
        } else if (typeof result.deleted_at === 'bigint') {
          ret.deleted_at = parseDate(Number(result.deleted_at));
        } else if (typeof result.deleted_at === 'number' || result.deleted_at.includes('+') || result.deleted_at.lastIndexOf('-') > 10 || result.deleted_at.endsWith('Z')) {
          ret.deleted_at = parseDate(result.deleted_at);
        } else {
          ret.deleted_at = parseDate(result.deleted_at + 'Z');
        }
        mapped.deleted_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_7000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity UserEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.sub === null) {
        entity.sub = null;
      } else if (typeof data.sub !== 'undefined') {
        entity.sub = data.sub;
      }
    }
  },
  'hydrator-user_7000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity UserEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.sub === null) {
        entity.sub = null;
      } else if (typeof data.sub !== 'undefined') {
        entity.sub = data.sub;
      }
    }
  },
  'pkGetter-user_7000': function(isEntityOrRef) {
    // compiled pk getter for entity UserEntity
    return function(entity) {
      return entity.sub;
    }
  },
  'pkGetterConverted-user_7000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity UserEntity
    return function(entity) {
      return entity.sub;
    }
  },
  'pkSerializer-user_7000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity UserEntity
    return function(entity) {
      return '' + entity.sub;
    }
  },
  'hydrator-user_consent_13000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_141, user_142, oauth_client_143, oauth_client_144, convertToJSValue_scopes, convertToDatabaseValue_scopes) {
    // compiled hydrator for entity UserConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_141, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_142, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_143, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_144, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.scopes === null) {
        entity.scopes = null;
      } else if (typeof data.scopes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scopes(data.scopes);
          data.scopes = convertToDatabaseValue_scopes(value);
          entity.scopes = value;
        } else {
          entity.scopes = data.scopes;
        }
      }
      if (data.granted_at === null) {
        entity.granted_at = null;
      } else if (typeof data.granted_at !== 'undefined') {
        if (data.granted_at instanceof Date) {
          entity.granted_at = data.granted_at;
        } else if (typeof data.granted_at === 'number' || data.granted_at.includes('+') || data.granted_at.lastIndexOf('-') > 10 || data.granted_at.endsWith('Z')) {
          entity.granted_at = new Date(data.granted_at);
        } else {
          entity.granted_at = new Date(data.granted_at + 'Z');
        }
      }
      if (data.revoked_at === null) {
        entity.revoked_at = null;
      } else if (typeof data.revoked_at !== 'undefined') {
        if (data.revoked_at instanceof Date) {
          entity.revoked_at = data.revoked_at;
        } else if (typeof data.revoked_at === 'number' || data.revoked_at.includes('+') || data.revoked_at.lastIndexOf('-') > 10 || data.revoked_at.endsWith('Z')) {
          entity.revoked_at = new Date(data.revoked_at);
        } else {
          entity.revoked_at = new Date(data.revoked_at + 'Z');
        }
      }
    }
  },
  'hydrator-user_consent_13000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_151, user_152, oauth_client_153, oauth_client_154, convertToJSValue_scopes, convertToDatabaseValue_scopes) {
    // compiled hydrator for entity UserConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_151, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_152, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_153, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_154, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.scopes === null) {
        entity.scopes = null;
      } else if (typeof data.scopes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scopes(data.scopes);
          data.scopes = convertToDatabaseValue_scopes(value);
          entity.scopes = value;
        } else {
          entity.scopes = data.scopes;
        }
      }
      if (data.granted_at === null) {
        entity.granted_at = null;
      } else if (typeof data.granted_at !== 'undefined') {
        if (data.granted_at instanceof Date) {
          entity.granted_at = data.granted_at;
        } else if (typeof data.granted_at === 'number' || data.granted_at.includes('+') || data.granted_at.lastIndexOf('-') > 10 || data.granted_at.endsWith('Z')) {
          entity.granted_at = new Date(data.granted_at);
        } else {
          entity.granted_at = new Date(data.granted_at + 'Z');
        }
      }
      if (data.revoked_at === null) {
        entity.revoked_at = null;
      } else if (typeof data.revoked_at !== 'undefined') {
        if (data.revoked_at instanceof Date) {
          entity.revoked_at = data.revoked_at;
        } else if (typeof data.revoked_at === 'number' || data.revoked_at.includes('+') || data.revoked_at.lastIndexOf('-') > 10 || data.revoked_at.endsWith('Z')) {
          entity.revoked_at = new Date(data.revoked_at);
        } else {
          entity.revoked_at = new Date(data.revoked_at + 'Z');
        }
      }
    }
  },
  'comparator-user_consent_13000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity UserConsentEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.client === null && last.client === undefined) {
        diff.client = current.client;
      } else if (current.client == null && last.client == null) {

      } else if ((current.client != null && last.client == null) || (current.client == null && last.client != null)) {
        diff.client = current.client;
      } else if (last.client !== current.client) {
        diff.client = current.client;
      }

      if (current.scopes === null && last.scopes === undefined) {
        diff.scopes = current.scopes;
      } else if (current.scopes == null && last.scopes == null) {

      } else if ((current.scopes != null && last.scopes == null) || (current.scopes == null && last.scopes != null)) {
        diff.scopes = current.scopes;
      } else if (!equals(last.scopes, current.scopes)) {
        diff.scopes = current.scopes;
      }

      if (current.granted_at === null && last.granted_at === undefined) {
        diff.granted_at = current.granted_at;
      } else if (current.granted_at == null && last.granted_at == null) {

      } else if ((current.granted_at != null && last.granted_at == null) || (current.granted_at == null && last.granted_at != null)) {
        diff.granted_at = current.granted_at;
      } else if (last.granted_at.valueOf() !== current.granted_at.valueOf()) {
        diff.granted_at = current.granted_at;
      }

      if (current.revoked_at === null && last.revoked_at === undefined) {
        diff.revoked_at = current.revoked_at;
      } else if (current.revoked_at == null && last.revoked_at == null) {

      } else if ((current.revoked_at != null && last.revoked_at == null) || (current.revoked_at == null && last.revoked_at != null)) {
        diff.revoked_at = current.revoked_at;
      } else if (last.revoked_at.valueOf() !== current.revoked_at.valueOf()) {
        diff.revoked_at = current.revoked_at;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-user_consent_13000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier, convertToDatabaseValue_scopes) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.client !== 'undefined') {
        if (entity.client === null) {
          ret.client = null;
        } else if (entity.client?.__helper.__identifier && !entity.client.__helper.hasPrimaryKey()) {
          ret.client = entity.client?.__helper.__identifier;
        } else if (typeof entity.client !== 'undefined') {
          ret.client = toArray(entity.client.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.scopes !== 'undefined') {
        ret.scopes = clone(convertToDatabaseValue_scopes(entity.scopes));
      }

      if (typeof entity.granted_at !== 'undefined') {
        ret.granted_at = clone(processDateProperty(entity.granted_at));
      }

      if (typeof entity.revoked_at !== 'undefined') {
        ret.revoked_at = clone(processDateProperty(entity.revoked_at));
      }

      return ret;
    }
  },
  'resultMapper-user_consent_13000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity UserConsentEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.client_id !== 'undefined') {
        ret.client = result.client_id;
        mapped.client_id = true;
      }
      if (typeof result.scopes !== 'undefined') {
        ret.scopes = result.scopes;
        mapped.scopes = true;
      }
      if (typeof result.granted_at !== 'undefined') {
        if (result.granted_at == null || result.granted_at instanceof Date) {
          ret.granted_at = result.granted_at;
        } else if (typeof result.granted_at === 'bigint') {
          ret.granted_at = parseDate(Number(result.granted_at));
        } else if (typeof result.granted_at === 'number' || result.granted_at.includes('+') || result.granted_at.lastIndexOf('-') > 10 || result.granted_at.endsWith('Z')) {
          ret.granted_at = parseDate(result.granted_at);
        } else {
          ret.granted_at = parseDate(result.granted_at + 'Z');
        }
        mapped.granted_at = true;
      }
      if (typeof result.revoked_at !== 'undefined') {
        if (result.revoked_at == null || result.revoked_at instanceof Date) {
          ret.revoked_at = result.revoked_at;
        } else if (typeof result.revoked_at === 'bigint') {
          ret.revoked_at = parseDate(Number(result.revoked_at));
        } else if (typeof result.revoked_at === 'number' || result.revoked_at.includes('+') || result.revoked_at.lastIndexOf('-') > 10 || result.revoked_at.endsWith('Z')) {
          ret.revoked_at = parseDate(result.revoked_at);
        } else {
          ret.revoked_at = parseDate(result.revoked_at + 'Z');
        }
        mapped.revoked_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-user_consent_13000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-user_consent_13000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity UserConsentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-user_consent_13000': function(isEntityOrRef) {
    // compiled pk getter for entity UserConsentEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-user_consent_13000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity UserConsentEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-user_consent_13000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity UserConsentEntity
    return function(entity) {
      const val_6 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_6);
    }
  },
  'hydrator-terms_20000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, terms_content_168, user_terms_consent_169) {
    // compiled hydrator for entity TermsEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.required === null) {
        entity.required = null;
      } else if (typeof data.required !== 'undefined') {
        entity.required = !!data.required;
      }
      if (data.consentMode === null) {
        entity.consentMode = null;
      } else if (typeof data.consentMode !== 'undefined') {
        entity.consentMode = data.consentMode;
      }
      if (data.version === null) {
        entity.version = null;
      } else if (typeof data.version !== 'undefined') {
        entity.version = data.version;
      }
      if (data.archivedAt === null) {
        entity.archivedAt = null;
      } else if (typeof data.archivedAt !== 'undefined') {
        if (data.archivedAt instanceof Date) {
          entity.archivedAt = data.archivedAt;
        } else if (typeof data.archivedAt === 'number' || data.archivedAt.includes('+') || data.archivedAt.lastIndexOf('-') > 10 || data.archivedAt.endsWith('Z')) {
          entity.archivedAt = new Date(data.archivedAt);
        } else {
          entity.archivedAt = new Date(data.archivedAt + 'Z');
        }
      }
      if (data.managed_by === null) {
        entity.managed_by = null;
      } else if (typeof data.managed_by !== 'undefined') {
        entity.managed_by = data.managed_by;
      }
      const createCollectionItem_contents = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(terms_content_168, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(terms_content_168, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.contents && !Array.isArray(data.contents) && typeof data.contents === 'object') {
        data.contents = [data.contents];
      }
      if (Array.isArray(data.contents)) {
        const items = data.contents.map(value => createCollectionItem_contents(value, entity));
        const coll = Collection.create(entity, 'contents', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.contents && data.contents instanceof Collection) {
        entity.contents = data.contents;
      } else if (!entity.contents) {
        const coll = Collection.create(entity, 'contents', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_consents = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_terms_consent_169, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_terms_consent_169, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.consents && !Array.isArray(data.consents) && typeof data.consents === 'object') {
        data.consents = [data.consents];
      }
      if (Array.isArray(data.consents)) {
        const items = data.consents.map(value => createCollectionItem_consents(value, entity));
        const coll = Collection.create(entity, 'consents', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.consents && data.consents instanceof Collection) {
        entity.consents = data.consents;
      } else if (!entity.consents) {
        const coll = Collection.create(entity, 'consents', undefined, newEntity);
        coll.setDirty(false);
      }
    }
  },
  'hydrator-terms_20000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, terms_content_178, user_terms_consent_179) {
    // compiled hydrator for entity TermsEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.required === null) {
        entity.required = null;
      } else if (typeof data.required !== 'undefined') {
        entity.required = !!data.required;
      }
      if (data.consentMode === null) {
        entity.consentMode = null;
      } else if (typeof data.consentMode !== 'undefined') {
        entity.consentMode = data.consentMode;
      }
      if (data.version === null) {
        entity.version = null;
      } else if (typeof data.version !== 'undefined') {
        entity.version = data.version;
      }
      if (data.archivedAt === null) {
        entity.archivedAt = null;
      } else if (typeof data.archivedAt !== 'undefined') {
        if (data.archivedAt instanceof Date) {
          entity.archivedAt = data.archivedAt;
        } else if (typeof data.archivedAt === 'number' || data.archivedAt.includes('+') || data.archivedAt.lastIndexOf('-') > 10 || data.archivedAt.endsWith('Z')) {
          entity.archivedAt = new Date(data.archivedAt);
        } else {
          entity.archivedAt = new Date(data.archivedAt + 'Z');
        }
      }
      if (data.managed_by === null) {
        entity.managed_by = null;
      } else if (typeof data.managed_by !== 'undefined') {
        entity.managed_by = data.managed_by;
      }
      const createCollectionItem_contents = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(terms_content_178, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(terms_content_178, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.contents && !Array.isArray(data.contents) && typeof data.contents === 'object') {
        data.contents = [data.contents];
      }
      if (Array.isArray(data.contents)) {
        const items = data.contents.map(value => createCollectionItem_contents(value, entity));
        const coll = Collection.create(entity, 'contents', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.contents && data.contents instanceof Collection) {
        entity.contents = data.contents;
      } else if (!entity.contents) {
        const coll = Collection.create(entity, 'contents', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_consents = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_terms_consent_179, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_terms_consent_179, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.consents && !Array.isArray(data.consents) && typeof data.consents === 'object') {
        data.consents = [data.consents];
      }
      if (Array.isArray(data.consents)) {
        const items = data.consents.map(value => createCollectionItem_consents(value, entity));
        const coll = Collection.create(entity, 'consents', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.consents && data.consents instanceof Collection) {
        entity.consents = data.consents;
      } else if (!entity.consents) {
        const coll = Collection.create(entity, 'consents', undefined, newEntity);
        coll.setDirty(false);
      }
    }
  },
  'comparator-terms_20000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity TermsEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.required === null && last.required === undefined) {
        diff.required = current.required;
      } else if (current.required == null && last.required == null) {

      } else if ((current.required != null && last.required == null) || (current.required == null && last.required != null)) {
        diff.required = current.required;
      } else if (!compareBooleans(last.required, current.required)) {
        diff.required = current.required;
      }

      if (current.consentMode === null && last.consentMode === undefined) {
        diff.consentMode = current.consentMode;
      } else if (current.consentMode == null && last.consentMode == null) {

      } else if ((current.consentMode != null && last.consentMode == null) || (current.consentMode == null && last.consentMode != null)) {
        diff.consentMode = current.consentMode;
      } else if (last.consentMode !== current.consentMode) {
        diff.consentMode = current.consentMode;
      }

      if (current.version === null && last.version === undefined) {
        diff.version = current.version;
      } else if (current.version == null && last.version == null) {

      } else if ((current.version != null && last.version == null) || (current.version == null && last.version != null)) {
        diff.version = current.version;
      } else if (last.version !== current.version) {
        diff.version = current.version;
      }

      if (current.archivedAt === null && last.archivedAt === undefined) {
        diff.archivedAt = current.archivedAt;
      } else if (current.archivedAt == null && last.archivedAt == null) {

      } else if ((current.archivedAt != null && last.archivedAt == null) || (current.archivedAt == null && last.archivedAt != null)) {
        diff.archivedAt = current.archivedAt;
      } else if (last.archivedAt.valueOf() !== current.archivedAt.valueOf()) {
        diff.archivedAt = current.archivedAt;
      }

      if (current.managed_by === null && last.managed_by === undefined) {
        diff.managed_by = current.managed_by;
      } else if (current.managed_by == null && last.managed_by == null) {

      } else if ((current.managed_by != null && last.managed_by == null) || (current.managed_by == null && last.managed_by != null)) {
        diff.managed_by = current.managed_by;
      } else if (last.managed_by !== current.managed_by) {
        diff.managed_by = current.managed_by;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-terms_20000': function(clone, cloneEmbeddable, processDateProperty) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = entity.id;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.required !== 'undefined') {
        ret.required = entity.required;
      }

      if (typeof entity.consentMode !== 'undefined') {
        ret.consentMode = entity.consentMode;
      }

      if (typeof entity.version !== 'undefined') {
        ret.version = entity.version;
      }

      if (typeof entity.archivedAt !== 'undefined') {
        ret.archivedAt = clone(processDateProperty(entity.archivedAt));
      }

      if (typeof entity.managed_by !== 'undefined') {
        ret.managed_by = entity.managed_by;
      }

      return ret;
    }
  },
  'resultMapper-terms_20000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity TermsEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.required !== 'undefined') {
        ret.required = result.required == null ? result.required : !!result.required;
        mapped.required = true;
      }
      if (typeof result.consent_mode !== 'undefined') {
        ret.consentMode = result.consent_mode;
        mapped.consent_mode = true;
      }
      if (typeof result.version !== 'undefined') {
        ret.version = result.version;
        mapped.version = true;
      }
      if (typeof result.archived_at !== 'undefined') {
        if (result.archived_at == null || result.archived_at instanceof Date) {
          ret.archivedAt = result.archived_at;
        } else if (typeof result.archived_at === 'bigint') {
          ret.archivedAt = parseDate(Number(result.archived_at));
        } else if (typeof result.archived_at === 'number' || result.archived_at.includes('+') || result.archived_at.lastIndexOf('-') > 10 || result.archived_at.endsWith('Z')) {
          ret.archivedAt = parseDate(result.archived_at);
        } else {
          ret.archivedAt = parseDate(result.archived_at + 'Z');
        }
        mapped.archived_at = true;
      }
      if (typeof result.managed_by !== 'undefined') {
        ret.managed_by = result.managed_by;
        mapped.managed_by = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-terms_20000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity TermsEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'hydrator-terms_20000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity TermsEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'pkGetter-terms_20000': function(isEntityOrRef) {
    // compiled pk getter for entity TermsEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-terms_20000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity TermsEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkSerializer-terms_20000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity TermsEntity
    return function(entity) {
      return '' + entity.id;
    }
  },
  'hydrator-terms_content_18000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, terms_185, terms_186) {
    // compiled hydrator for entity TermsContentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.terms === null) {
        entity.terms = null;
      } else if (typeof data.terms !== 'undefined') {
        if (isPrimaryKey(data.terms, true)) {
          entity.terms = factory.createReference(terms_185, data.terms, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.terms && typeof data.terms === 'object') {
          entity.terms = factory.create(terms_186, data.terms, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.lang === null) {
        entity.lang = null;
      } else if (typeof data.lang !== 'undefined') {
        entity.lang = data.lang;
      }
      if (data.title === null) {
        entity.title = null;
      } else if (typeof data.title !== 'undefined') {
        entity.title = data.title;
      }
      if (data.type === null) {
        entity.type = null;
      } else if (typeof data.type !== 'undefined') {
        entity.type = data.type;
      }
      if (data.content === null) {
        entity.content = null;
      } else if (typeof data.content !== 'undefined') {
        entity.content = data.content;
      }
    }
  },
  'hydrator-terms_content_18000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, terms_194, terms_195) {
    // compiled hydrator for entity TermsContentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.terms === null) {
        entity.terms = null;
      } else if (typeof data.terms !== 'undefined') {
        if (isPrimaryKey(data.terms, true)) {
          entity.terms = factory.createReference(terms_194, data.terms, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.terms && typeof data.terms === 'object') {
          entity.terms = factory.create(terms_195, data.terms, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.lang === null) {
        entity.lang = null;
      } else if (typeof data.lang !== 'undefined') {
        entity.lang = data.lang;
      }
      if (data.title === null) {
        entity.title = null;
      } else if (typeof data.title !== 'undefined') {
        entity.title = data.title;
      }
      if (data.type === null) {
        entity.type = null;
      } else if (typeof data.type !== 'undefined') {
        entity.type = data.type;
      }
      if (data.content === null) {
        entity.content = null;
      } else if (typeof data.content !== 'undefined') {
        entity.content = data.content;
      }
    }
  },
  'comparator-terms_content_18000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity TermsContentEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.terms === null && last.terms === undefined) {
        diff.terms = current.terms;
      } else if (current.terms == null && last.terms == null) {

      } else if ((current.terms != null && last.terms == null) || (current.terms == null && last.terms != null)) {
        diff.terms = current.terms;
      } else if (last.terms !== current.terms) {
        diff.terms = current.terms;
      }

      if (current.lang === null && last.lang === undefined) {
        diff.lang = current.lang;
      } else if (current.lang == null && last.lang == null) {

      } else if ((current.lang != null && last.lang == null) || (current.lang == null && last.lang != null)) {
        diff.lang = current.lang;
      } else if (last.lang !== current.lang) {
        diff.lang = current.lang;
      }

      if (current.title === null && last.title === undefined) {
        diff.title = current.title;
      } else if (current.title == null && last.title == null) {

      } else if ((current.title != null && last.title == null) || (current.title == null && last.title != null)) {
        diff.title = current.title;
      } else if (last.title !== current.title) {
        diff.title = current.title;
      }

      if (current.type === null && last.type === undefined) {
        diff.type = current.type;
      } else if (current.type == null && last.type == null) {

      } else if ((current.type != null && last.type == null) || (current.type == null && last.type != null)) {
        diff.type = current.type;
      } else if (last.type !== current.type) {
        diff.type = current.type;
      }

      if (current.content === null && last.content === undefined) {
        diff.content = current.content;
      } else if (current.content == null && last.content == null) {

      } else if ((current.content != null && last.content == null) || (current.content == null && last.content != null)) {
        diff.content = current.content;
      } else if (!equals(last.content, current.content)) {
        diff.content = current.content;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-terms_content_18000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.terms !== 'undefined') {
        if (entity.terms === null) {
          ret.terms = null;
        } else if (entity.terms?.__helper.__identifier && !entity.terms.__helper.hasPrimaryKey()) {
          ret.terms = entity.terms?.__helper.__identifier;
        } else if (typeof entity.terms !== 'undefined') {
          ret.terms = toArray(entity.terms.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.lang !== 'undefined') {
        ret.lang = entity.lang;
      }

      if (typeof entity.title !== 'undefined') {
        ret.title = entity.title;
      }

      if (typeof entity.type !== 'undefined') {
        ret.type = entity.type;
      }

      if (typeof entity.content !== 'undefined') {
        ret.content = clone(entity.content);
      }

      return ret;
    }
  },
  'resultMapper-terms_content_18000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity TermsContentEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.terms_id !== 'undefined') {
        ret.terms = result.terms_id;
        mapped.terms_id = true;
      }
      if (typeof result.lang !== 'undefined') {
        ret.lang = result.lang;
        mapped.lang = true;
      }
      if (typeof result.title !== 'undefined') {
        ret.title = result.title;
        mapped.title = true;
      }
      if (typeof result.type !== 'undefined') {
        ret.type = result.type;
        mapped.type = true;
      }
      if (typeof result.content !== 'undefined') {
        ret.content = result.content;
        mapped.content = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-terms_content_18000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity TermsContentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-terms_content_18000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity TermsContentEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-terms_content_18000': function(isEntityOrRef) {
    // compiled pk getter for entity TermsContentEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-terms_content_18000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity TermsContentEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-terms_content_18000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity TermsContentEntity
    return function(entity) {
      const val_7 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_7);
    }
  },
  'hydrator-scheduled_jobs_17000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity SchedulerJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.name === null) {
        entity.name = null;
      } else if (typeof data.name !== 'undefined') {
        entity.name = data.name;
      }
      if (data.enabled === null) {
        entity.enabled = null;
      } else if (typeof data.enabled !== 'undefined') {
        entity.enabled = !!data.enabled;
      }
      if (data.cron === null) {
        entity.cron = null;
      } else if (typeof data.cron !== 'undefined') {
        entity.cron = data.cron;
      }
      if (data.nextRunAt === null) {
        entity.nextRunAt = null;
      } else if (typeof data.nextRunAt !== 'undefined') {
        if (data.nextRunAt instanceof Date) {
          entity.nextRunAt = data.nextRunAt;
        } else if (typeof data.nextRunAt === 'number' || data.nextRunAt.includes('+') || data.nextRunAt.lastIndexOf('-') > 10 || data.nextRunAt.endsWith('Z')) {
          entity.nextRunAt = new Date(data.nextRunAt);
        } else {
          entity.nextRunAt = new Date(data.nextRunAt + 'Z');
        }
      }
      if (data.lastRunAt === null) {
        entity.lastRunAt = null;
      } else if (typeof data.lastRunAt !== 'undefined') {
        if (data.lastRunAt instanceof Date) {
          entity.lastRunAt = data.lastRunAt;
        } else if (typeof data.lastRunAt === 'number' || data.lastRunAt.includes('+') || data.lastRunAt.lastIndexOf('-') > 10 || data.lastRunAt.endsWith('Z')) {
          entity.lastRunAt = new Date(data.lastRunAt);
        } else {
          entity.lastRunAt = new Date(data.lastRunAt + 'Z');
        }
      }
      if (data.lastSuccessAt === null) {
        entity.lastSuccessAt = null;
      } else if (typeof data.lastSuccessAt !== 'undefined') {
        if (data.lastSuccessAt instanceof Date) {
          entity.lastSuccessAt = data.lastSuccessAt;
        } else if (typeof data.lastSuccessAt === 'number' || data.lastSuccessAt.includes('+') || data.lastSuccessAt.lastIndexOf('-') > 10 || data.lastSuccessAt.endsWith('Z')) {
          entity.lastSuccessAt = new Date(data.lastSuccessAt);
        } else {
          entity.lastSuccessAt = new Date(data.lastSuccessAt + 'Z');
        }
      }
      if (data.lastErrorAt === null) {
        entity.lastErrorAt = null;
      } else if (typeof data.lastErrorAt !== 'undefined') {
        if (data.lastErrorAt instanceof Date) {
          entity.lastErrorAt = data.lastErrorAt;
        } else if (typeof data.lastErrorAt === 'number' || data.lastErrorAt.includes('+') || data.lastErrorAt.lastIndexOf('-') > 10 || data.lastErrorAt.endsWith('Z')) {
          entity.lastErrorAt = new Date(data.lastErrorAt);
        } else {
          entity.lastErrorAt = new Date(data.lastErrorAt + 'Z');
        }
      }
      if (data.lastError === null) {
        entity.lastError = null;
      } else if (typeof data.lastError !== 'undefined') {
        entity.lastError = data.lastError;
      }
      if (data.lockedBy === null) {
        entity.lockedBy = null;
      } else if (typeof data.lockedBy !== 'undefined') {
        entity.lockedBy = data.lockedBy;
      }
      if (data.lockedUntil === null) {
        entity.lockedUntil = null;
      } else if (typeof data.lockedUntil !== 'undefined') {
        if (data.lockedUntil instanceof Date) {
          entity.lockedUntil = data.lockedUntil;
        } else if (typeof data.lockedUntil === 'number' || data.lockedUntil.includes('+') || data.lockedUntil.lastIndexOf('-') > 10 || data.lockedUntil.endsWith('Z')) {
          entity.lockedUntil = new Date(data.lockedUntil);
        } else {
          entity.lockedUntil = new Date(data.lockedUntil + 'Z');
        }
      }
      if (data.runCount === null) {
        entity.runCount = null;
      } else if (typeof data.runCount !== 'undefined') {
        entity.runCount = data.runCount;
      }
      if (data.failureCount === null) {
        entity.failureCount = null;
      } else if (typeof data.failureCount !== 'undefined') {
        entity.failureCount = data.failureCount;
      }
    }
  },
  'hydrator-scheduled_jobs_17000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity SchedulerJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.name === null) {
        entity.name = null;
      } else if (typeof data.name !== 'undefined') {
        entity.name = data.name;
      }
      if (data.enabled === null) {
        entity.enabled = null;
      } else if (typeof data.enabled !== 'undefined') {
        entity.enabled = !!data.enabled;
      }
      if (data.cron === null) {
        entity.cron = null;
      } else if (typeof data.cron !== 'undefined') {
        entity.cron = data.cron;
      }
      if (data.nextRunAt === null) {
        entity.nextRunAt = null;
      } else if (typeof data.nextRunAt !== 'undefined') {
        if (data.nextRunAt instanceof Date) {
          entity.nextRunAt = data.nextRunAt;
        } else if (typeof data.nextRunAt === 'number' || data.nextRunAt.includes('+') || data.nextRunAt.lastIndexOf('-') > 10 || data.nextRunAt.endsWith('Z')) {
          entity.nextRunAt = new Date(data.nextRunAt);
        } else {
          entity.nextRunAt = new Date(data.nextRunAt + 'Z');
        }
      }
      if (data.lastRunAt === null) {
        entity.lastRunAt = null;
      } else if (typeof data.lastRunAt !== 'undefined') {
        if (data.lastRunAt instanceof Date) {
          entity.lastRunAt = data.lastRunAt;
        } else if (typeof data.lastRunAt === 'number' || data.lastRunAt.includes('+') || data.lastRunAt.lastIndexOf('-') > 10 || data.lastRunAt.endsWith('Z')) {
          entity.lastRunAt = new Date(data.lastRunAt);
        } else {
          entity.lastRunAt = new Date(data.lastRunAt + 'Z');
        }
      }
      if (data.lastSuccessAt === null) {
        entity.lastSuccessAt = null;
      } else if (typeof data.lastSuccessAt !== 'undefined') {
        if (data.lastSuccessAt instanceof Date) {
          entity.lastSuccessAt = data.lastSuccessAt;
        } else if (typeof data.lastSuccessAt === 'number' || data.lastSuccessAt.includes('+') || data.lastSuccessAt.lastIndexOf('-') > 10 || data.lastSuccessAt.endsWith('Z')) {
          entity.lastSuccessAt = new Date(data.lastSuccessAt);
        } else {
          entity.lastSuccessAt = new Date(data.lastSuccessAt + 'Z');
        }
      }
      if (data.lastErrorAt === null) {
        entity.lastErrorAt = null;
      } else if (typeof data.lastErrorAt !== 'undefined') {
        if (data.lastErrorAt instanceof Date) {
          entity.lastErrorAt = data.lastErrorAt;
        } else if (typeof data.lastErrorAt === 'number' || data.lastErrorAt.includes('+') || data.lastErrorAt.lastIndexOf('-') > 10 || data.lastErrorAt.endsWith('Z')) {
          entity.lastErrorAt = new Date(data.lastErrorAt);
        } else {
          entity.lastErrorAt = new Date(data.lastErrorAt + 'Z');
        }
      }
      if (data.lastError === null) {
        entity.lastError = null;
      } else if (typeof data.lastError !== 'undefined') {
        entity.lastError = data.lastError;
      }
      if (data.lockedBy === null) {
        entity.lockedBy = null;
      } else if (typeof data.lockedBy !== 'undefined') {
        entity.lockedBy = data.lockedBy;
      }
      if (data.lockedUntil === null) {
        entity.lockedUntil = null;
      } else if (typeof data.lockedUntil !== 'undefined') {
        if (data.lockedUntil instanceof Date) {
          entity.lockedUntil = data.lockedUntil;
        } else if (typeof data.lockedUntil === 'number' || data.lockedUntil.includes('+') || data.lockedUntil.lastIndexOf('-') > 10 || data.lockedUntil.endsWith('Z')) {
          entity.lockedUntil = new Date(data.lockedUntil);
        } else {
          entity.lockedUntil = new Date(data.lockedUntil + 'Z');
        }
      }
      if (data.runCount === null) {
        entity.runCount = null;
      } else if (typeof data.runCount !== 'undefined') {
        entity.runCount = data.runCount;
      }
      if (data.failureCount === null) {
        entity.failureCount = null;
      } else if (typeof data.failureCount !== 'undefined') {
        entity.failureCount = data.failureCount;
      }
    }
  },
  'comparator-scheduled_jobs_17000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity SchedulerJobEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.name === null && last.name === undefined) {
        diff.name = current.name;
      } else if (current.name == null && last.name == null) {

      } else if ((current.name != null && last.name == null) || (current.name == null && last.name != null)) {
        diff.name = current.name;
      } else if (last.name !== current.name) {
        diff.name = current.name;
      }

      if (current.enabled === null && last.enabled === undefined) {
        diff.enabled = current.enabled;
      } else if (current.enabled == null && last.enabled == null) {

      } else if ((current.enabled != null && last.enabled == null) || (current.enabled == null && last.enabled != null)) {
        diff.enabled = current.enabled;
      } else if (!compareBooleans(last.enabled, current.enabled)) {
        diff.enabled = current.enabled;
      }

      if (current.cron === null && last.cron === undefined) {
        diff.cron = current.cron;
      } else if (current.cron == null && last.cron == null) {

      } else if ((current.cron != null && last.cron == null) || (current.cron == null && last.cron != null)) {
        diff.cron = current.cron;
      } else if (last.cron !== current.cron) {
        diff.cron = current.cron;
      }

      if (current.nextRunAt === null && last.nextRunAt === undefined) {
        diff.nextRunAt = current.nextRunAt;
      } else if (current.nextRunAt == null && last.nextRunAt == null) {

      } else if ((current.nextRunAt != null && last.nextRunAt == null) || (current.nextRunAt == null && last.nextRunAt != null)) {
        diff.nextRunAt = current.nextRunAt;
      } else if (last.nextRunAt.valueOf() !== current.nextRunAt.valueOf()) {
        diff.nextRunAt = current.nextRunAt;
      }

      if (current.lastRunAt === null && last.lastRunAt === undefined) {
        diff.lastRunAt = current.lastRunAt;
      } else if (current.lastRunAt == null && last.lastRunAt == null) {

      } else if ((current.lastRunAt != null && last.lastRunAt == null) || (current.lastRunAt == null && last.lastRunAt != null)) {
        diff.lastRunAt = current.lastRunAt;
      } else if (last.lastRunAt.valueOf() !== current.lastRunAt.valueOf()) {
        diff.lastRunAt = current.lastRunAt;
      }

      if (current.lastSuccessAt === null && last.lastSuccessAt === undefined) {
        diff.lastSuccessAt = current.lastSuccessAt;
      } else if (current.lastSuccessAt == null && last.lastSuccessAt == null) {

      } else if ((current.lastSuccessAt != null && last.lastSuccessAt == null) || (current.lastSuccessAt == null && last.lastSuccessAt != null)) {
        diff.lastSuccessAt = current.lastSuccessAt;
      } else if (last.lastSuccessAt.valueOf() !== current.lastSuccessAt.valueOf()) {
        diff.lastSuccessAt = current.lastSuccessAt;
      }

      if (current.lastErrorAt === null && last.lastErrorAt === undefined) {
        diff.lastErrorAt = current.lastErrorAt;
      } else if (current.lastErrorAt == null && last.lastErrorAt == null) {

      } else if ((current.lastErrorAt != null && last.lastErrorAt == null) || (current.lastErrorAt == null && last.lastErrorAt != null)) {
        diff.lastErrorAt = current.lastErrorAt;
      } else if (last.lastErrorAt.valueOf() !== current.lastErrorAt.valueOf()) {
        diff.lastErrorAt = current.lastErrorAt;
      }

      if (current.lastError === null && last.lastError === undefined) {
        diff.lastError = current.lastError;
      } else if (current.lastError == null && last.lastError == null) {

      } else if ((current.lastError != null && last.lastError == null) || (current.lastError == null && last.lastError != null)) {
        diff.lastError = current.lastError;
      } else if (!equals(last.lastError, current.lastError)) {
        diff.lastError = current.lastError;
      }

      if (current.lockedBy === null && last.lockedBy === undefined) {
        diff.lockedBy = current.lockedBy;
      } else if (current.lockedBy == null && last.lockedBy == null) {

      } else if ((current.lockedBy != null && last.lockedBy == null) || (current.lockedBy == null && last.lockedBy != null)) {
        diff.lockedBy = current.lockedBy;
      } else if (last.lockedBy !== current.lockedBy) {
        diff.lockedBy = current.lockedBy;
      }

      if (current.lockedUntil === null && last.lockedUntil === undefined) {
        diff.lockedUntil = current.lockedUntil;
      } else if (current.lockedUntil == null && last.lockedUntil == null) {

      } else if ((current.lockedUntil != null && last.lockedUntil == null) || (current.lockedUntil == null && last.lockedUntil != null)) {
        diff.lockedUntil = current.lockedUntil;
      } else if (last.lockedUntil.valueOf() !== current.lockedUntil.valueOf()) {
        diff.lockedUntil = current.lockedUntil;
      }

      if (current.runCount === null && last.runCount === undefined) {
        diff.runCount = current.runCount;
      } else if (current.runCount == null && last.runCount == null) {

      } else if ((current.runCount != null && last.runCount == null) || (current.runCount == null && last.runCount != null)) {
        diff.runCount = current.runCount;
      } else if (!equals(last.runCount, current.runCount)) {
        diff.runCount = current.runCount;
      }

      if (current.failureCount === null && last.failureCount === undefined) {
        diff.failureCount = current.failureCount;
      } else if (current.failureCount == null && last.failureCount == null) {

      } else if ((current.failureCount != null && last.failureCount == null) || (current.failureCount == null && last.failureCount != null)) {
        diff.failureCount = current.failureCount;
      } else if (!equals(last.failureCount, current.failureCount)) {
        diff.failureCount = current.failureCount;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-scheduled_jobs_17000': function(clone, cloneEmbeddable, processDateProperty) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = entity.id;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.name !== 'undefined') {
        ret.name = entity.name;
      }

      if (typeof entity.enabled !== 'undefined') {
        ret.enabled = entity.enabled;
      }

      if (typeof entity.cron !== 'undefined') {
        ret.cron = entity.cron;
      }

      if (typeof entity.nextRunAt !== 'undefined') {
        ret.nextRunAt = clone(processDateProperty(entity.nextRunAt));
      }

      if (typeof entity.lastRunAt !== 'undefined') {
        ret.lastRunAt = clone(processDateProperty(entity.lastRunAt));
      }

      if (typeof entity.lastSuccessAt !== 'undefined') {
        ret.lastSuccessAt = clone(processDateProperty(entity.lastSuccessAt));
      }

      if (typeof entity.lastErrorAt !== 'undefined') {
        ret.lastErrorAt = clone(processDateProperty(entity.lastErrorAt));
      }

      if (typeof entity.lastError !== 'undefined') {
        ret.lastError = clone(entity.lastError);
      }

      if (typeof entity.lockedBy !== 'undefined') {
        ret.lockedBy = entity.lockedBy;
      }

      if (typeof entity.lockedUntil !== 'undefined') {
        ret.lockedUntil = clone(processDateProperty(entity.lockedUntil));
      }

      if (typeof entity.runCount !== 'undefined') {
        ret.runCount = clone(entity.runCount);
      }

      if (typeof entity.failureCount !== 'undefined') {
        ret.failureCount = clone(entity.failureCount);
      }

      return ret;
    }
  },
  'resultMapper-scheduled_jobs_17000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity SchedulerJobEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.name !== 'undefined') {
        ret.name = result.name;
        mapped.name = true;
      }
      if (typeof result.enabled !== 'undefined') {
        ret.enabled = result.enabled == null ? result.enabled : !!result.enabled;
        mapped.enabled = true;
      }
      if (typeof result.cron !== 'undefined') {
        ret.cron = result.cron;
        mapped.cron = true;
      }
      if (typeof result.next_run_at !== 'undefined') {
        if (result.next_run_at == null || result.next_run_at instanceof Date) {
          ret.nextRunAt = result.next_run_at;
        } else if (typeof result.next_run_at === 'bigint') {
          ret.nextRunAt = parseDate(Number(result.next_run_at));
        } else if (typeof result.next_run_at === 'number' || result.next_run_at.includes('+') || result.next_run_at.lastIndexOf('-') > 10 || result.next_run_at.endsWith('Z')) {
          ret.nextRunAt = parseDate(result.next_run_at);
        } else {
          ret.nextRunAt = parseDate(result.next_run_at + 'Z');
        }
        mapped.next_run_at = true;
      }
      if (typeof result.last_run_at !== 'undefined') {
        if (result.last_run_at == null || result.last_run_at instanceof Date) {
          ret.lastRunAt = result.last_run_at;
        } else if (typeof result.last_run_at === 'bigint') {
          ret.lastRunAt = parseDate(Number(result.last_run_at));
        } else if (typeof result.last_run_at === 'number' || result.last_run_at.includes('+') || result.last_run_at.lastIndexOf('-') > 10 || result.last_run_at.endsWith('Z')) {
          ret.lastRunAt = parseDate(result.last_run_at);
        } else {
          ret.lastRunAt = parseDate(result.last_run_at + 'Z');
        }
        mapped.last_run_at = true;
      }
      if (typeof result.last_success_at !== 'undefined') {
        if (result.last_success_at == null || result.last_success_at instanceof Date) {
          ret.lastSuccessAt = result.last_success_at;
        } else if (typeof result.last_success_at === 'bigint') {
          ret.lastSuccessAt = parseDate(Number(result.last_success_at));
        } else if (typeof result.last_success_at === 'number' || result.last_success_at.includes('+') || result.last_success_at.lastIndexOf('-') > 10 || result.last_success_at.endsWith('Z')) {
          ret.lastSuccessAt = parseDate(result.last_success_at);
        } else {
          ret.lastSuccessAt = parseDate(result.last_success_at + 'Z');
        }
        mapped.last_success_at = true;
      }
      if (typeof result.last_error_at !== 'undefined') {
        if (result.last_error_at == null || result.last_error_at instanceof Date) {
          ret.lastErrorAt = result.last_error_at;
        } else if (typeof result.last_error_at === 'bigint') {
          ret.lastErrorAt = parseDate(Number(result.last_error_at));
        } else if (typeof result.last_error_at === 'number' || result.last_error_at.includes('+') || result.last_error_at.lastIndexOf('-') > 10 || result.last_error_at.endsWith('Z')) {
          ret.lastErrorAt = parseDate(result.last_error_at);
        } else {
          ret.lastErrorAt = parseDate(result.last_error_at + 'Z');
        }
        mapped.last_error_at = true;
      }
      if (typeof result.last_error !== 'undefined') {
        ret.lastError = result.last_error;
        mapped.last_error = true;
      }
      if (typeof result.locked_by !== 'undefined') {
        ret.lockedBy = result.locked_by;
        mapped.locked_by = true;
      }
      if (typeof result.locked_until !== 'undefined') {
        if (result.locked_until == null || result.locked_until instanceof Date) {
          ret.lockedUntil = result.locked_until;
        } else if (typeof result.locked_until === 'bigint') {
          ret.lockedUntil = parseDate(Number(result.locked_until));
        } else if (typeof result.locked_until === 'number' || result.locked_until.includes('+') || result.locked_until.lastIndexOf('-') > 10 || result.locked_until.endsWith('Z')) {
          ret.lockedUntil = parseDate(result.locked_until);
        } else {
          ret.lockedUntil = parseDate(result.locked_until + 'Z');
        }
        mapped.locked_until = true;
      }
      if (typeof result.run_count !== 'undefined') {
        ret.runCount = result.run_count;
        mapped.run_count = true;
      }
      if (typeof result.failure_count !== 'undefined') {
        ret.failureCount = result.failure_count;
        mapped.failure_count = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-scheduled_jobs_17000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity SchedulerJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'hydrator-scheduled_jobs_17000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity SchedulerJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'pkGetter-scheduled_jobs_17000': function(isEntityOrRef) {
    // compiled pk getter for entity SchedulerJobEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-scheduled_jobs_17000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity SchedulerJobEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkSerializer-scheduled_jobs_17000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity SchedulerJobEntity
    return function(entity) {
      return '' + entity.id;
    }
  },
  'hydrator-revoked_tokens_12000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, oauth_client_239, oauth_client_240, user_241, user_242) {
    // compiled hydrator for entity RevokedTokenEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.jti === null) {
        entity.jti = null;
      } else if (typeof data.jti !== 'undefined') {
        entity.jti = data.jti;
      }
      if (data.token_type === null) {
        entity.token_type = null;
      } else if (typeof data.token_type !== 'undefined') {
        entity.token_type = data.token_type;
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_239, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_240, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_241, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_242, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.expires_at === null) {
        entity.expires_at = null;
      } else if (typeof data.expires_at !== 'undefined') {
        if (data.expires_at instanceof Date) {
          entity.expires_at = data.expires_at;
        } else if (typeof data.expires_at === 'number' || data.expires_at.includes('+') || data.expires_at.lastIndexOf('-') > 10 || data.expires_at.endsWith('Z')) {
          entity.expires_at = new Date(data.expires_at);
        } else {
          entity.expires_at = new Date(data.expires_at + 'Z');
        }
      }
      if (data.revoked_at === null) {
        entity.revoked_at = null;
      } else if (typeof data.revoked_at !== 'undefined') {
        if (data.revoked_at instanceof Date) {
          entity.revoked_at = data.revoked_at;
        } else if (typeof data.revoked_at === 'number' || data.revoked_at.includes('+') || data.revoked_at.lastIndexOf('-') > 10 || data.revoked_at.endsWith('Z')) {
          entity.revoked_at = new Date(data.revoked_at);
        } else {
          entity.revoked_at = new Date(data.revoked_at + 'Z');
        }
      }
    }
  },
  'hydrator-revoked_tokens_12000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, oauth_client_250, oauth_client_251, user_252, user_253) {
    // compiled hydrator for entity RevokedTokenEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.jti === null) {
        entity.jti = null;
      } else if (typeof data.jti !== 'undefined') {
        entity.jti = data.jti;
      }
      if (data.token_type === null) {
        entity.token_type = null;
      } else if (typeof data.token_type !== 'undefined') {
        entity.token_type = data.token_type;
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_250, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_251, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = factory.createReference(user_252, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.user && typeof data.user === 'object') {
          entity.user = factory.create(user_253, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.expires_at === null) {
        entity.expires_at = null;
      } else if (typeof data.expires_at !== 'undefined') {
        if (data.expires_at instanceof Date) {
          entity.expires_at = data.expires_at;
        } else if (typeof data.expires_at === 'number' || data.expires_at.includes('+') || data.expires_at.lastIndexOf('-') > 10 || data.expires_at.endsWith('Z')) {
          entity.expires_at = new Date(data.expires_at);
        } else {
          entity.expires_at = new Date(data.expires_at + 'Z');
        }
      }
      if (data.revoked_at === null) {
        entity.revoked_at = null;
      } else if (typeof data.revoked_at !== 'undefined') {
        if (data.revoked_at instanceof Date) {
          entity.revoked_at = data.revoked_at;
        } else if (typeof data.revoked_at === 'number' || data.revoked_at.includes('+') || data.revoked_at.lastIndexOf('-') > 10 || data.revoked_at.endsWith('Z')) {
          entity.revoked_at = new Date(data.revoked_at);
        } else {
          entity.revoked_at = new Date(data.revoked_at + 'Z');
        }
      }
    }
  },
  'comparator-revoked_tokens_12000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity RevokedTokenEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.jti === null && last.jti === undefined) {
        diff.jti = current.jti;
      } else if (current.jti == null && last.jti == null) {

      } else if ((current.jti != null && last.jti == null) || (current.jti == null && last.jti != null)) {
        diff.jti = current.jti;
      } else if (last.jti !== current.jti) {
        diff.jti = current.jti;
      }

      if (current.token_type === null && last.token_type === undefined) {
        diff.token_type = current.token_type;
      } else if (current.token_type == null && last.token_type == null) {

      } else if ((current.token_type != null && last.token_type == null) || (current.token_type == null && last.token_type != null)) {
        diff.token_type = current.token_type;
      } else if (last.token_type !== current.token_type) {
        diff.token_type = current.token_type;
      }

      if (current.client === null && last.client === undefined) {
        diff.client = current.client;
      } else if (current.client == null && last.client == null) {

      } else if ((current.client != null && last.client == null) || (current.client == null && last.client != null)) {
        diff.client = current.client;
      } else if (last.client !== current.client) {
        diff.client = current.client;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.expires_at === null && last.expires_at === undefined) {
        diff.expires_at = current.expires_at;
      } else if (current.expires_at == null && last.expires_at == null) {

      } else if ((current.expires_at != null && last.expires_at == null) || (current.expires_at == null && last.expires_at != null)) {
        diff.expires_at = current.expires_at;
      } else if (last.expires_at.valueOf() !== current.expires_at.valueOf()) {
        diff.expires_at = current.expires_at;
      }

      if (current.revoked_at === null && last.revoked_at === undefined) {
        diff.revoked_at = current.revoked_at;
      } else if (current.revoked_at == null && last.revoked_at == null) {

      } else if ((current.revoked_at != null && last.revoked_at == null) || (current.revoked_at == null && last.revoked_at != null)) {
        diff.revoked_at = current.revoked_at;
      } else if (last.revoked_at.valueOf() !== current.revoked_at.valueOf()) {
        diff.revoked_at = current.revoked_at;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-revoked_tokens_12000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.jti !== 'undefined') {
        ret.jti = entity.jti;
      }

      if (typeof entity.token_type !== 'undefined') {
        ret.token_type = entity.token_type;
      }

      if (typeof entity.client !== 'undefined') {
        if (entity.client === null) {
          ret.client = null;
        } else if (entity.client?.__helper.__identifier && !entity.client.__helper.hasPrimaryKey()) {
          ret.client = entity.client?.__helper.__identifier;
        } else if (typeof entity.client !== 'undefined') {
          ret.client = toArray(entity.client.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.expires_at !== 'undefined') {
        ret.expires_at = clone(processDateProperty(entity.expires_at));
      }

      if (typeof entity.revoked_at !== 'undefined') {
        ret.revoked_at = clone(processDateProperty(entity.revoked_at));
      }

      return ret;
    }
  },
  'resultMapper-revoked_tokens_12000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity RevokedTokenEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.jti !== 'undefined') {
        ret.jti = result.jti;
        mapped.jti = true;
      }
      if (typeof result.token_type !== 'undefined') {
        ret.token_type = result.token_type;
        mapped.token_type = true;
      }
      if (typeof result.client_id !== 'undefined') {
        ret.client = result.client_id;
        mapped.client_id = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expires_at = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expires_at = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expires_at = parseDate(result.expires_at);
        } else {
          ret.expires_at = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      if (typeof result.revoked_at !== 'undefined') {
        if (result.revoked_at == null || result.revoked_at instanceof Date) {
          ret.revoked_at = result.revoked_at;
        } else if (typeof result.revoked_at === 'bigint') {
          ret.revoked_at = parseDate(Number(result.revoked_at));
        } else if (typeof result.revoked_at === 'number' || result.revoked_at.includes('+') || result.revoked_at.lastIndexOf('-') > 10 || result.revoked_at.endsWith('Z')) {
          ret.revoked_at = parseDate(result.revoked_at);
        } else {
          ret.revoked_at = parseDate(result.revoked_at + 'Z');
        }
        mapped.revoked_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-revoked_tokens_12000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity RevokedTokenEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-revoked_tokens_12000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity RevokedTokenEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-revoked_tokens_12000': function(isEntityOrRef) {
    // compiled pk getter for entity RevokedTokenEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-revoked_tokens_12000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity RevokedTokenEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-revoked_tokens_12000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity RevokedTokenEntity
    return function(entity) {
      const val_8 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_8);
    }
  },
  'hydrator-pending_oauth_registration_16000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, convertToJSValue_userInfo, convertToDatabaseValue_userInfo) {
    // compiled hydrator for entity PendingOAuthRegistrationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.token === null) {
        entity.token = null;
      } else if (typeof data.token !== 'undefined') {
        entity.token = data.token;
      }
      if (data.providerId === null) {
        entity.providerId = null;
      } else if (typeof data.providerId !== 'undefined') {
        entity.providerId = data.providerId;
      }
      if (data.accessToken === null) {
        entity.accessToken = null;
      } else if (typeof data.accessToken !== 'undefined') {
        entity.accessToken = data.accessToken;
      }
      if (data.refreshToken === null) {
        entity.refreshToken = null;
      } else if (typeof data.refreshToken !== 'undefined') {
        entity.refreshToken = data.refreshToken;
      }
      if (data.expiresIn === null) {
        entity.expiresIn = null;
      } else if (typeof data.expiresIn !== 'undefined') {
        entity.expiresIn = data.expiresIn;
      }
      if (data.tokenType === null) {
        entity.tokenType = null;
      } else if (typeof data.tokenType !== 'undefined') {
        entity.tokenType = data.tokenType;
      }
      if (data.userInfo === null) {
        entity.userInfo = null;
      } else if (typeof data.userInfo !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_userInfo(data.userInfo);
          data.userInfo = convertToDatabaseValue_userInfo(value);
          entity.userInfo = value;
        } else {
          entity.userInfo = data.userInfo;
        }
      }
      if (data.returnUrl === null) {
        entity.returnUrl = null;
      } else if (typeof data.returnUrl !== 'undefined') {
        entity.returnUrl = data.returnUrl;
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
    }
  },
  'hydrator-pending_oauth_registration_16000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, convertToJSValue_userInfo, convertToDatabaseValue_userInfo) {
    // compiled hydrator for entity PendingOAuthRegistrationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.token === null) {
        entity.token = null;
      } else if (typeof data.token !== 'undefined') {
        entity.token = data.token;
      }
      if (data.providerId === null) {
        entity.providerId = null;
      } else if (typeof data.providerId !== 'undefined') {
        entity.providerId = data.providerId;
      }
      if (data.accessToken === null) {
        entity.accessToken = null;
      } else if (typeof data.accessToken !== 'undefined') {
        entity.accessToken = data.accessToken;
      }
      if (data.refreshToken === null) {
        entity.refreshToken = null;
      } else if (typeof data.refreshToken !== 'undefined') {
        entity.refreshToken = data.refreshToken;
      }
      if (data.expiresIn === null) {
        entity.expiresIn = null;
      } else if (typeof data.expiresIn !== 'undefined') {
        entity.expiresIn = data.expiresIn;
      }
      if (data.tokenType === null) {
        entity.tokenType = null;
      } else if (typeof data.tokenType !== 'undefined') {
        entity.tokenType = data.tokenType;
      }
      if (data.userInfo === null) {
        entity.userInfo = null;
      } else if (typeof data.userInfo !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_userInfo(data.userInfo);
          data.userInfo = convertToDatabaseValue_userInfo(value);
          entity.userInfo = value;
        } else {
          entity.userInfo = data.userInfo;
        }
      }
      if (data.returnUrl === null) {
        entity.returnUrl = null;
      } else if (typeof data.returnUrl !== 'undefined') {
        entity.returnUrl = data.returnUrl;
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
    }
  },
  'comparator-pending_oauth_registration_16000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity PendingOAuthRegistrationEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.token === null && last.token === undefined) {
        diff.token = current.token;
      } else if (current.token == null && last.token == null) {

      } else if ((current.token != null && last.token == null) || (current.token == null && last.token != null)) {
        diff.token = current.token;
      } else if (last.token !== current.token) {
        diff.token = current.token;
      }

      if (current.providerId === null && last.providerId === undefined) {
        diff.providerId = current.providerId;
      } else if (current.providerId == null && last.providerId == null) {

      } else if ((current.providerId != null && last.providerId == null) || (current.providerId == null && last.providerId != null)) {
        diff.providerId = current.providerId;
      } else if (last.providerId !== current.providerId) {
        diff.providerId = current.providerId;
      }

      if (current.accessToken === null && last.accessToken === undefined) {
        diff.accessToken = current.accessToken;
      } else if (current.accessToken == null && last.accessToken == null) {

      } else if ((current.accessToken != null && last.accessToken == null) || (current.accessToken == null && last.accessToken != null)) {
        diff.accessToken = current.accessToken;
      } else if (!equals(last.accessToken, current.accessToken)) {
        diff.accessToken = current.accessToken;
      }

      if (current.refreshToken === null && last.refreshToken === undefined) {
        diff.refreshToken = current.refreshToken;
      } else if (current.refreshToken == null && last.refreshToken == null) {

      } else if ((current.refreshToken != null && last.refreshToken == null) || (current.refreshToken == null && last.refreshToken != null)) {
        diff.refreshToken = current.refreshToken;
      } else if (!equals(last.refreshToken, current.refreshToken)) {
        diff.refreshToken = current.refreshToken;
      }

      if (current.expiresIn === null && last.expiresIn === undefined) {
        diff.expiresIn = current.expiresIn;
      } else if (current.expiresIn == null && last.expiresIn == null) {

      } else if ((current.expiresIn != null && last.expiresIn == null) || (current.expiresIn == null && last.expiresIn != null)) {
        diff.expiresIn = current.expiresIn;
      } else if (!equals(last.expiresIn, current.expiresIn)) {
        diff.expiresIn = current.expiresIn;
      }

      if (current.tokenType === null && last.tokenType === undefined) {
        diff.tokenType = current.tokenType;
      } else if (current.tokenType == null && last.tokenType == null) {

      } else if ((current.tokenType != null && last.tokenType == null) || (current.tokenType == null && last.tokenType != null)) {
        diff.tokenType = current.tokenType;
      } else if (last.tokenType !== current.tokenType) {
        diff.tokenType = current.tokenType;
      }

      if (current.userInfo === null && last.userInfo === undefined) {
        diff.userInfo = current.userInfo;
      } else if (current.userInfo == null && last.userInfo == null) {

      } else if ((current.userInfo != null && last.userInfo == null) || (current.userInfo == null && last.userInfo != null)) {
        diff.userInfo = current.userInfo;
      } else if (!equals(last.userInfo, current.userInfo)) {
        diff.userInfo = current.userInfo;
      }

      if (current.returnUrl === null && last.returnUrl === undefined) {
        diff.returnUrl = current.returnUrl;
      } else if (current.returnUrl == null && last.returnUrl == null) {

      } else if ((current.returnUrl != null && last.returnUrl == null) || (current.returnUrl == null && last.returnUrl != null)) {
        diff.returnUrl = current.returnUrl;
      } else if (last.returnUrl !== current.returnUrl) {
        diff.returnUrl = current.returnUrl;
      }

      if (current.expiresAt === null && last.expiresAt === undefined) {
        diff.expiresAt = current.expiresAt;
      } else if (current.expiresAt == null && last.expiresAt == null) {

      } else if ((current.expiresAt != null && last.expiresAt == null) || (current.expiresAt == null && last.expiresAt != null)) {
        diff.expiresAt = current.expiresAt;
      } else if (last.expiresAt.valueOf() !== current.expiresAt.valueOf()) {
        diff.expiresAt = current.expiresAt;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-pending_oauth_registration_16000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, convertToDatabaseValue_userInfo) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.token !== 'undefined') {
        ret.token = entity.token;
      }

      if (typeof entity.providerId !== 'undefined') {
        ret.providerId = entity.providerId;
      }

      if (typeof entity.accessToken !== 'undefined') {
        ret.accessToken = clone(entity.accessToken);
      }

      if (typeof entity.refreshToken !== 'undefined') {
        ret.refreshToken = clone(entity.refreshToken);
      }

      if (typeof entity.expiresIn !== 'undefined') {
        ret.expiresIn = clone(entity.expiresIn);
      }

      if (typeof entity.tokenType !== 'undefined') {
        ret.tokenType = entity.tokenType;
      }

      if (typeof entity.userInfo !== 'undefined') {
        ret.userInfo = clone(convertToDatabaseValue_userInfo(entity.userInfo));
      }

      if (typeof entity.returnUrl !== 'undefined') {
        ret.returnUrl = entity.returnUrl;
      }

      if (typeof entity.expiresAt !== 'undefined') {
        ret.expiresAt = clone(processDateProperty(entity.expiresAt));
      }

      return ret;
    }
  },
  'resultMapper-pending_oauth_registration_16000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity PendingOAuthRegistrationEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.token !== 'undefined') {
        ret.token = result.token;
        mapped.token = true;
      }
      if (typeof result.provider_id !== 'undefined') {
        ret.providerId = result.provider_id;
        mapped.provider_id = true;
      }
      if (typeof result.access_token !== 'undefined') {
        ret.accessToken = result.access_token;
        mapped.access_token = true;
      }
      if (typeof result.refresh_token !== 'undefined') {
        ret.refreshToken = result.refresh_token;
        mapped.refresh_token = true;
      }
      if (typeof result.expires_in !== 'undefined') {
        ret.expiresIn = result.expires_in;
        mapped.expires_in = true;
      }
      if (typeof result.token_type !== 'undefined') {
        ret.tokenType = result.token_type;
        mapped.token_type = true;
      }
      if (typeof result.user_info !== 'undefined') {
        ret.userInfo = result.user_info;
        mapped.user_info = true;
      }
      if (typeof result.return_url !== 'undefined') {
        ret.returnUrl = result.return_url;
        mapped.return_url = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expiresAt = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expiresAt = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expiresAt = parseDate(result.expires_at);
        } else {
          ret.expiresAt = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-pending_oauth_registration_16000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity PendingOAuthRegistrationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-pending_oauth_registration_16000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity PendingOAuthRegistrationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-pending_oauth_registration_16000': function(isEntityOrRef) {
    // compiled pk getter for entity PendingOAuthRegistrationEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-pending_oauth_registration_16000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity PendingOAuthRegistrationEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-pending_oauth_registration_16000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity PendingOAuthRegistrationEntity
    return function(entity) {
      const val_9 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_9);
    }
  },
  'hydrator-password_reset_15000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_287, user_288) {
    // compiled hydrator for entity PasswordResetEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_287, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_288, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.token === null) {
        entity.token = null;
      } else if (typeof data.token !== 'undefined') {
        entity.token = data.token;
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
      if (data.used === null) {
        entity.used = null;
      } else if (typeof data.used !== 'undefined') {
        entity.used = !!data.used;
      }
      if (data.usedAt === null) {
        entity.usedAt = null;
      } else if (typeof data.usedAt !== 'undefined') {
        if (data.usedAt instanceof Date) {
          entity.usedAt = data.usedAt;
        } else if (typeof data.usedAt === 'number' || data.usedAt.includes('+') || data.usedAt.lastIndexOf('-') > 10 || data.usedAt.endsWith('Z')) {
          entity.usedAt = new Date(data.usedAt);
        } else {
          entity.usedAt = new Date(data.usedAt + 'Z');
        }
      }
    }
  },
  'hydrator-password_reset_15000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_296, user_297) {
    // compiled hydrator for entity PasswordResetEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_296, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_297, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.token === null) {
        entity.token = null;
      } else if (typeof data.token !== 'undefined') {
        entity.token = data.token;
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
      if (data.used === null) {
        entity.used = null;
      } else if (typeof data.used !== 'undefined') {
        entity.used = !!data.used;
      }
      if (data.usedAt === null) {
        entity.usedAt = null;
      } else if (typeof data.usedAt !== 'undefined') {
        if (data.usedAt instanceof Date) {
          entity.usedAt = data.usedAt;
        } else if (typeof data.usedAt === 'number' || data.usedAt.includes('+') || data.usedAt.lastIndexOf('-') > 10 || data.usedAt.endsWith('Z')) {
          entity.usedAt = new Date(data.usedAt);
        } else {
          entity.usedAt = new Date(data.usedAt + 'Z');
        }
      }
    }
  },
  'comparator-password_reset_15000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity PasswordResetEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.token === null && last.token === undefined) {
        diff.token = current.token;
      } else if (current.token == null && last.token == null) {

      } else if ((current.token != null && last.token == null) || (current.token == null && last.token != null)) {
        diff.token = current.token;
      } else if (last.token !== current.token) {
        diff.token = current.token;
      }

      if (current.expiresAt === null && last.expiresAt === undefined) {
        diff.expiresAt = current.expiresAt;
      } else if (current.expiresAt == null && last.expiresAt == null) {

      } else if ((current.expiresAt != null && last.expiresAt == null) || (current.expiresAt == null && last.expiresAt != null)) {
        diff.expiresAt = current.expiresAt;
      } else if (last.expiresAt.valueOf() !== current.expiresAt.valueOf()) {
        diff.expiresAt = current.expiresAt;
      }

      if (current.used === null && last.used === undefined) {
        diff.used = current.used;
      } else if (current.used == null && last.used == null) {

      } else if ((current.used != null && last.used == null) || (current.used == null && last.used != null)) {
        diff.used = current.used;
      } else if (!compareBooleans(last.used, current.used)) {
        diff.used = current.used;
      }

      if (current.usedAt === null && last.usedAt === undefined) {
        diff.usedAt = current.usedAt;
      } else if (current.usedAt == null && last.usedAt == null) {

      } else if ((current.usedAt != null && last.usedAt == null) || (current.usedAt == null && last.usedAt != null)) {
        diff.usedAt = current.usedAt;
      } else if (last.usedAt.valueOf() !== current.usedAt.valueOf()) {
        diff.usedAt = current.usedAt;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-password_reset_15000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.token !== 'undefined') {
        ret.token = entity.token;
      }

      if (typeof entity.expiresAt !== 'undefined') {
        ret.expiresAt = clone(processDateProperty(entity.expiresAt));
      }

      if (typeof entity.used !== 'undefined') {
        ret.used = entity.used;
      }

      if (typeof entity.usedAt !== 'undefined') {
        ret.usedAt = clone(processDateProperty(entity.usedAt));
      }

      return ret;
    }
  },
  'resultMapper-password_reset_15000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity PasswordResetEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.token !== 'undefined') {
        ret.token = result.token;
        mapped.token = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expiresAt = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expiresAt = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expiresAt = parseDate(result.expires_at);
        } else {
          ret.expiresAt = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      if (typeof result.used !== 'undefined') {
        ret.used = result.used == null ? result.used : !!result.used;
        mapped.used = true;
      }
      if (typeof result.used_at !== 'undefined') {
        if (result.used_at == null || result.used_at instanceof Date) {
          ret.usedAt = result.used_at;
        } else if (typeof result.used_at === 'bigint') {
          ret.usedAt = parseDate(Number(result.used_at));
        } else if (typeof result.used_at === 'number' || result.used_at.includes('+') || result.used_at.lastIndexOf('-') > 10 || result.used_at.endsWith('Z')) {
          ret.usedAt = parseDate(result.used_at);
        } else {
          ret.usedAt = parseDate(result.used_at + 'Z');
        }
        mapped.used_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-password_reset_15000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity PasswordResetEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-password_reset_15000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity PasswordResetEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-password_reset_15000': function(isEntityOrRef) {
    // compiled pk getter for entity PasswordResetEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-password_reset_15000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity PasswordResetEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-password_reset_15000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity PasswordResetEntity
    return function(entity) {
      const val_10 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_10);
    }
  },
  'hydrator-oauth_device_code_11000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, oauth_client_309, oauth_client_310, convertToJSValue_scope, convertToDatabaseValue_scope, user_313, user_314) {
    // compiled hydrator for entity OAuthDeviceCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.deviceCodeHash === null) {
        entity.deviceCodeHash = null;
      } else if (typeof data.deviceCodeHash !== 'undefined') {
        entity.deviceCodeHash = data.deviceCodeHash;
      }
      if (data.userCodeHash === null) {
        entity.userCodeHash = null;
      } else if (typeof data.userCodeHash !== 'undefined') {
        entity.userCodeHash = data.userCodeHash;
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_309, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_310, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.scope === null) {
        entity.scope = null;
      } else if (typeof data.scope !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scope(data.scope);
          data.scope = convertToDatabaseValue_scope(value);
          entity.scope = value;
        } else {
          entity.scope = data.scope;
        }
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
      if (data.authorizedUser === null) {
        entity.authorizedUser = null;
      } else if (typeof data.authorizedUser !== 'undefined') {
        if (isPrimaryKey(data.authorizedUser, true)) {
          entity.authorizedUser = factory.createReference(user_313, data.authorizedUser, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.authorizedUser && typeof data.authorizedUser === 'object') {
          entity.authorizedUser = factory.create(user_314, data.authorizedUser, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.authorizedAt === null) {
        entity.authorizedAt = null;
      } else if (typeof data.authorizedAt !== 'undefined') {
        if (data.authorizedAt instanceof Date) {
          entity.authorizedAt = data.authorizedAt;
        } else if (typeof data.authorizedAt === 'number' || data.authorizedAt.includes('+') || data.authorizedAt.lastIndexOf('-') > 10 || data.authorizedAt.endsWith('Z')) {
          entity.authorizedAt = new Date(data.authorizedAt);
        } else {
          entity.authorizedAt = new Date(data.authorizedAt + 'Z');
        }
      }
      if (data.deniedAt === null) {
        entity.deniedAt = null;
      } else if (typeof data.deniedAt !== 'undefined') {
        if (data.deniedAt instanceof Date) {
          entity.deniedAt = data.deniedAt;
        } else if (typeof data.deniedAt === 'number' || data.deniedAt.includes('+') || data.deniedAt.lastIndexOf('-') > 10 || data.deniedAt.endsWith('Z')) {
          entity.deniedAt = new Date(data.deniedAt);
        } else {
          entity.deniedAt = new Date(data.deniedAt + 'Z');
        }
      }
      if (data.lastPolledAt === null) {
        entity.lastPolledAt = null;
      } else if (typeof data.lastPolledAt !== 'undefined') {
        if (data.lastPolledAt instanceof Date) {
          entity.lastPolledAt = data.lastPolledAt;
        } else if (typeof data.lastPolledAt === 'number' || data.lastPolledAt.includes('+') || data.lastPolledAt.lastIndexOf('-') > 10 || data.lastPolledAt.endsWith('Z')) {
          entity.lastPolledAt = new Date(data.lastPolledAt);
        } else {
          entity.lastPolledAt = new Date(data.lastPolledAt + 'Z');
        }
      }
      if (data.pollIntervalSeconds === null) {
        entity.pollIntervalSeconds = null;
      } else if (typeof data.pollIntervalSeconds !== 'undefined') {
        entity.pollIntervalSeconds = data.pollIntervalSeconds;
      }
      if (data.consumedAt === null) {
        entity.consumedAt = null;
      } else if (typeof data.consumedAt !== 'undefined') {
        if (data.consumedAt instanceof Date) {
          entity.consumedAt = data.consumedAt;
        } else if (typeof data.consumedAt === 'number' || data.consumedAt.includes('+') || data.consumedAt.lastIndexOf('-') > 10 || data.consumedAt.endsWith('Z')) {
          entity.consumedAt = new Date(data.consumedAt);
        } else {
          entity.consumedAt = new Date(data.consumedAt + 'Z');
        }
      }
    }
  },
  'hydrator-oauth_device_code_11000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, oauth_client_325, oauth_client_326, convertToJSValue_scope, convertToDatabaseValue_scope, user_329, user_330) {
    // compiled hydrator for entity OAuthDeviceCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.deviceCodeHash === null) {
        entity.deviceCodeHash = null;
      } else if (typeof data.deviceCodeHash !== 'undefined') {
        entity.deviceCodeHash = data.deviceCodeHash;
      }
      if (data.userCodeHash === null) {
        entity.userCodeHash = null;
      } else if (typeof data.userCodeHash !== 'undefined') {
        entity.userCodeHash = data.userCodeHash;
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_325, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_326, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.scope === null) {
        entity.scope = null;
      } else if (typeof data.scope !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scope(data.scope);
          data.scope = convertToDatabaseValue_scope(value);
          entity.scope = value;
        } else {
          entity.scope = data.scope;
        }
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
      if (data.authorizedUser === null) {
        entity.authorizedUser = null;
      } else if (typeof data.authorizedUser !== 'undefined') {
        if (isPrimaryKey(data.authorizedUser, true)) {
          entity.authorizedUser = factory.createReference(user_329, data.authorizedUser, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.authorizedUser && typeof data.authorizedUser === 'object') {
          entity.authorizedUser = factory.create(user_330, data.authorizedUser, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.authorizedAt === null) {
        entity.authorizedAt = null;
      } else if (typeof data.authorizedAt !== 'undefined') {
        if (data.authorizedAt instanceof Date) {
          entity.authorizedAt = data.authorizedAt;
        } else if (typeof data.authorizedAt === 'number' || data.authorizedAt.includes('+') || data.authorizedAt.lastIndexOf('-') > 10 || data.authorizedAt.endsWith('Z')) {
          entity.authorizedAt = new Date(data.authorizedAt);
        } else {
          entity.authorizedAt = new Date(data.authorizedAt + 'Z');
        }
      }
      if (data.deniedAt === null) {
        entity.deniedAt = null;
      } else if (typeof data.deniedAt !== 'undefined') {
        if (data.deniedAt instanceof Date) {
          entity.deniedAt = data.deniedAt;
        } else if (typeof data.deniedAt === 'number' || data.deniedAt.includes('+') || data.deniedAt.lastIndexOf('-') > 10 || data.deniedAt.endsWith('Z')) {
          entity.deniedAt = new Date(data.deniedAt);
        } else {
          entity.deniedAt = new Date(data.deniedAt + 'Z');
        }
      }
      if (data.lastPolledAt === null) {
        entity.lastPolledAt = null;
      } else if (typeof data.lastPolledAt !== 'undefined') {
        if (data.lastPolledAt instanceof Date) {
          entity.lastPolledAt = data.lastPolledAt;
        } else if (typeof data.lastPolledAt === 'number' || data.lastPolledAt.includes('+') || data.lastPolledAt.lastIndexOf('-') > 10 || data.lastPolledAt.endsWith('Z')) {
          entity.lastPolledAt = new Date(data.lastPolledAt);
        } else {
          entity.lastPolledAt = new Date(data.lastPolledAt + 'Z');
        }
      }
      if (data.pollIntervalSeconds === null) {
        entity.pollIntervalSeconds = null;
      } else if (typeof data.pollIntervalSeconds !== 'undefined') {
        entity.pollIntervalSeconds = data.pollIntervalSeconds;
      }
      if (data.consumedAt === null) {
        entity.consumedAt = null;
      } else if (typeof data.consumedAt !== 'undefined') {
        if (data.consumedAt instanceof Date) {
          entity.consumedAt = data.consumedAt;
        } else if (typeof data.consumedAt === 'number' || data.consumedAt.includes('+') || data.consumedAt.lastIndexOf('-') > 10 || data.consumedAt.endsWith('Z')) {
          entity.consumedAt = new Date(data.consumedAt);
        } else {
          entity.consumedAt = new Date(data.consumedAt + 'Z');
        }
      }
    }
  },
  'comparator-oauth_device_code_11000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity OAuthDeviceCodeEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.deviceCodeHash === null && last.deviceCodeHash === undefined) {
        diff.deviceCodeHash = current.deviceCodeHash;
      } else if (current.deviceCodeHash == null && last.deviceCodeHash == null) {

      } else if ((current.deviceCodeHash != null && last.deviceCodeHash == null) || (current.deviceCodeHash == null && last.deviceCodeHash != null)) {
        diff.deviceCodeHash = current.deviceCodeHash;
      } else if (last.deviceCodeHash !== current.deviceCodeHash) {
        diff.deviceCodeHash = current.deviceCodeHash;
      }

      if (current.userCodeHash === null && last.userCodeHash === undefined) {
        diff.userCodeHash = current.userCodeHash;
      } else if (current.userCodeHash == null && last.userCodeHash == null) {

      } else if ((current.userCodeHash != null && last.userCodeHash == null) || (current.userCodeHash == null && last.userCodeHash != null)) {
        diff.userCodeHash = current.userCodeHash;
      } else if (last.userCodeHash !== current.userCodeHash) {
        diff.userCodeHash = current.userCodeHash;
      }

      if (current.client === null && last.client === undefined) {
        diff.client = current.client;
      } else if (current.client == null && last.client == null) {

      } else if ((current.client != null && last.client == null) || (current.client == null && last.client != null)) {
        diff.client = current.client;
      } else if (last.client !== current.client) {
        diff.client = current.client;
      }

      if (current.scope === null && last.scope === undefined) {
        diff.scope = current.scope;
      } else if (current.scope == null && last.scope == null) {

      } else if ((current.scope != null && last.scope == null) || (current.scope == null && last.scope != null)) {
        diff.scope = current.scope;
      } else if (!equals(last.scope, current.scope)) {
        diff.scope = current.scope;
      }

      if (current.expiresAt === null && last.expiresAt === undefined) {
        diff.expiresAt = current.expiresAt;
      } else if (current.expiresAt == null && last.expiresAt == null) {

      } else if ((current.expiresAt != null && last.expiresAt == null) || (current.expiresAt == null && last.expiresAt != null)) {
        diff.expiresAt = current.expiresAt;
      } else if (last.expiresAt.valueOf() !== current.expiresAt.valueOf()) {
        diff.expiresAt = current.expiresAt;
      }

      if (current.authorizedUser === null && last.authorizedUser === undefined) {
        diff.authorizedUser = current.authorizedUser;
      } else if (current.authorizedUser == null && last.authorizedUser == null) {

      } else if ((current.authorizedUser != null && last.authorizedUser == null) || (current.authorizedUser == null && last.authorizedUser != null)) {
        diff.authorizedUser = current.authorizedUser;
      } else if (last.authorizedUser !== current.authorizedUser) {
        diff.authorizedUser = current.authorizedUser;
      }

      if (current.authorizedAt === null && last.authorizedAt === undefined) {
        diff.authorizedAt = current.authorizedAt;
      } else if (current.authorizedAt == null && last.authorizedAt == null) {

      } else if ((current.authorizedAt != null && last.authorizedAt == null) || (current.authorizedAt == null && last.authorizedAt != null)) {
        diff.authorizedAt = current.authorizedAt;
      } else if (last.authorizedAt.valueOf() !== current.authorizedAt.valueOf()) {
        diff.authorizedAt = current.authorizedAt;
      }

      if (current.deniedAt === null && last.deniedAt === undefined) {
        diff.deniedAt = current.deniedAt;
      } else if (current.deniedAt == null && last.deniedAt == null) {

      } else if ((current.deniedAt != null && last.deniedAt == null) || (current.deniedAt == null && last.deniedAt != null)) {
        diff.deniedAt = current.deniedAt;
      } else if (last.deniedAt.valueOf() !== current.deniedAt.valueOf()) {
        diff.deniedAt = current.deniedAt;
      }

      if (current.lastPolledAt === null && last.lastPolledAt === undefined) {
        diff.lastPolledAt = current.lastPolledAt;
      } else if (current.lastPolledAt == null && last.lastPolledAt == null) {

      } else if ((current.lastPolledAt != null && last.lastPolledAt == null) || (current.lastPolledAt == null && last.lastPolledAt != null)) {
        diff.lastPolledAt = current.lastPolledAt;
      } else if (last.lastPolledAt.valueOf() !== current.lastPolledAt.valueOf()) {
        diff.lastPolledAt = current.lastPolledAt;
      }

      if (current.pollIntervalSeconds === null && last.pollIntervalSeconds === undefined) {
        diff.pollIntervalSeconds = current.pollIntervalSeconds;
      } else if (current.pollIntervalSeconds == null && last.pollIntervalSeconds == null) {

      } else if ((current.pollIntervalSeconds != null && last.pollIntervalSeconds == null) || (current.pollIntervalSeconds == null && last.pollIntervalSeconds != null)) {
        diff.pollIntervalSeconds = current.pollIntervalSeconds;
      } else if (!equals(last.pollIntervalSeconds, current.pollIntervalSeconds)) {
        diff.pollIntervalSeconds = current.pollIntervalSeconds;
      }

      if (current.consumedAt === null && last.consumedAt === undefined) {
        diff.consumedAt = current.consumedAt;
      } else if (current.consumedAt == null && last.consumedAt == null) {

      } else if ((current.consumedAt != null && last.consumedAt == null) || (current.consumedAt == null && last.consumedAt != null)) {
        diff.consumedAt = current.consumedAt;
      } else if (last.consumedAt.valueOf() !== current.consumedAt.valueOf()) {
        diff.consumedAt = current.consumedAt;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-oauth_device_code_11000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier, convertToDatabaseValue_scope) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.deviceCodeHash !== 'undefined') {
        ret.deviceCodeHash = entity.deviceCodeHash;
      }

      if (typeof entity.userCodeHash !== 'undefined') {
        ret.userCodeHash = entity.userCodeHash;
      }

      if (typeof entity.client !== 'undefined') {
        if (entity.client === null) {
          ret.client = null;
        } else if (entity.client?.__helper.__identifier && !entity.client.__helper.hasPrimaryKey()) {
          ret.client = entity.client?.__helper.__identifier;
        } else if (typeof entity.client !== 'undefined') {
          ret.client = toArray(entity.client.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.scope !== 'undefined') {
        ret.scope = clone(convertToDatabaseValue_scope(entity.scope));
      }

      if (typeof entity.expiresAt !== 'undefined') {
        ret.expiresAt = clone(processDateProperty(entity.expiresAt));
      }

      if (typeof entity.authorizedUser !== 'undefined') {
        if (entity.authorizedUser === null) {
          ret.authorizedUser = null;
        } else if (entity.authorizedUser?.__helper.__identifier && !entity.authorizedUser.__helper.hasPrimaryKey()) {
          ret.authorizedUser = entity.authorizedUser?.__helper.__identifier;
        } else if (typeof entity.authorizedUser !== 'undefined') {
          ret.authorizedUser = toArray(entity.authorizedUser.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.authorizedAt !== 'undefined') {
        ret.authorizedAt = clone(processDateProperty(entity.authorizedAt));
      }

      if (typeof entity.deniedAt !== 'undefined') {
        ret.deniedAt = clone(processDateProperty(entity.deniedAt));
      }

      if (typeof entity.lastPolledAt !== 'undefined') {
        ret.lastPolledAt = clone(processDateProperty(entity.lastPolledAt));
      }

      if (typeof entity.pollIntervalSeconds !== 'undefined') {
        ret.pollIntervalSeconds = clone(entity.pollIntervalSeconds);
      }

      if (typeof entity.consumedAt !== 'undefined') {
        ret.consumedAt = clone(processDateProperty(entity.consumedAt));
      }

      return ret;
    }
  },
  'resultMapper-oauth_device_code_11000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity OAuthDeviceCodeEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.device_code_hash !== 'undefined') {
        ret.deviceCodeHash = result.device_code_hash;
        mapped.device_code_hash = true;
      }
      if (typeof result.user_code_hash !== 'undefined') {
        ret.userCodeHash = result.user_code_hash;
        mapped.user_code_hash = true;
      }
      if (typeof result.client_id !== 'undefined') {
        ret.client = result.client_id;
        mapped.client_id = true;
      }
      if (typeof result.scope !== 'undefined') {
        ret.scope = result.scope;
        mapped.scope = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expiresAt = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expiresAt = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expiresAt = parseDate(result.expires_at);
        } else {
          ret.expiresAt = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      if (typeof result.authorized_user_sub !== 'undefined') {
        ret.authorizedUser = result.authorized_user_sub;
        mapped.authorized_user_sub = true;
      }
      if (typeof result.authorized_at !== 'undefined') {
        if (result.authorized_at == null || result.authorized_at instanceof Date) {
          ret.authorizedAt = result.authorized_at;
        } else if (typeof result.authorized_at === 'bigint') {
          ret.authorizedAt = parseDate(Number(result.authorized_at));
        } else if (typeof result.authorized_at === 'number' || result.authorized_at.includes('+') || result.authorized_at.lastIndexOf('-') > 10 || result.authorized_at.endsWith('Z')) {
          ret.authorizedAt = parseDate(result.authorized_at);
        } else {
          ret.authorizedAt = parseDate(result.authorized_at + 'Z');
        }
        mapped.authorized_at = true;
      }
      if (typeof result.denied_at !== 'undefined') {
        if (result.denied_at == null || result.denied_at instanceof Date) {
          ret.deniedAt = result.denied_at;
        } else if (typeof result.denied_at === 'bigint') {
          ret.deniedAt = parseDate(Number(result.denied_at));
        } else if (typeof result.denied_at === 'number' || result.denied_at.includes('+') || result.denied_at.lastIndexOf('-') > 10 || result.denied_at.endsWith('Z')) {
          ret.deniedAt = parseDate(result.denied_at);
        } else {
          ret.deniedAt = parseDate(result.denied_at + 'Z');
        }
        mapped.denied_at = true;
      }
      if (typeof result.last_polled_at !== 'undefined') {
        if (result.last_polled_at == null || result.last_polled_at instanceof Date) {
          ret.lastPolledAt = result.last_polled_at;
        } else if (typeof result.last_polled_at === 'bigint') {
          ret.lastPolledAt = parseDate(Number(result.last_polled_at));
        } else if (typeof result.last_polled_at === 'number' || result.last_polled_at.includes('+') || result.last_polled_at.lastIndexOf('-') > 10 || result.last_polled_at.endsWith('Z')) {
          ret.lastPolledAt = parseDate(result.last_polled_at);
        } else {
          ret.lastPolledAt = parseDate(result.last_polled_at + 'Z');
        }
        mapped.last_polled_at = true;
      }
      if (typeof result.poll_interval_seconds !== 'undefined') {
        ret.pollIntervalSeconds = result.poll_interval_seconds;
        mapped.poll_interval_seconds = true;
      }
      if (typeof result.consumed_at !== 'undefined') {
        if (result.consumed_at == null || result.consumed_at instanceof Date) {
          ret.consumedAt = result.consumed_at;
        } else if (typeof result.consumed_at === 'bigint') {
          ret.consumedAt = parseDate(Number(result.consumed_at));
        } else if (typeof result.consumed_at === 'number' || result.consumed_at.includes('+') || result.consumed_at.lastIndexOf('-') > 10 || result.consumed_at.endsWith('Z')) {
          ret.consumedAt = parseDate(result.consumed_at);
        } else {
          ret.consumedAt = parseDate(result.consumed_at + 'Z');
        }
        mapped.consumed_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-oauth_device_code_11000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity OAuthDeviceCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-oauth_device_code_11000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity OAuthDeviceCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-oauth_device_code_11000': function(isEntityOrRef) {
    // compiled pk getter for entity OAuthDeviceCodeEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-oauth_device_code_11000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity OAuthDeviceCodeEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-oauth_device_code_11000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity OAuthDeviceCodeEntity
    return function(entity) {
      const val_11 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_11);
    }
  },
  'hydrator-oauth_code_10000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, oauth_client_342, oauth_client_343, user_344, user_345, convertToJSValue_scope, convertToDatabaseValue_scope) {
    // compiled hydrator for entity OAuthCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.codeHash === null) {
        entity.codeHash = null;
      } else if (typeof data.codeHash !== 'undefined') {
        entity.codeHash = data.codeHash;
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_342, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_343, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_344, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_345, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.redirectUri === null) {
        entity.redirectUri = null;
      } else if (typeof data.redirectUri !== 'undefined') {
        entity.redirectUri = data.redirectUri;
      }
      if (data.scope === null) {
        entity.scope = null;
      } else if (typeof data.scope !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scope(data.scope);
          data.scope = convertToDatabaseValue_scope(value);
          entity.scope = value;
        } else {
          entity.scope = data.scope;
        }
      }
      if (data.nonce === null) {
        entity.nonce = null;
      } else if (typeof data.nonce !== 'undefined') {
        entity.nonce = data.nonce;
      }
      if (data.codeChallenge === null) {
        entity.codeChallenge = null;
      } else if (typeof data.codeChallenge !== 'undefined') {
        entity.codeChallenge = data.codeChallenge;
      }
      if (data.codeChallengeMethod === null) {
        entity.codeChallengeMethod = null;
      } else if (typeof data.codeChallengeMethod !== 'undefined') {
        entity.codeChallengeMethod = data.codeChallengeMethod;
      }
      if (data.expiredAt === null) {
        entity.expiredAt = null;
      } else if (typeof data.expiredAt !== 'undefined') {
        if (data.expiredAt instanceof Date) {
          entity.expiredAt = data.expiredAt;
        } else if (typeof data.expiredAt === 'number' || data.expiredAt.includes('+') || data.expiredAt.lastIndexOf('-') > 10 || data.expiredAt.endsWith('Z')) {
          entity.expiredAt = new Date(data.expiredAt);
        } else {
          entity.expiredAt = new Date(data.expiredAt + 'Z');
        }
      }
      if (data.consumedAt === null) {
        entity.consumedAt = null;
      } else if (typeof data.consumedAt !== 'undefined') {
        if (data.consumedAt instanceof Date) {
          entity.consumedAt = data.consumedAt;
        } else if (typeof data.consumedAt === 'number' || data.consumedAt.includes('+') || data.consumedAt.lastIndexOf('-') > 10 || data.consumedAt.endsWith('Z')) {
          entity.consumedAt = new Date(data.consumedAt);
        } else {
          entity.consumedAt = new Date(data.consumedAt + 'Z');
        }
      }
      if (data.authTime === null) {
        entity.authTime = null;
      } else if (typeof data.authTime !== 'undefined') {
        entity.authTime = data.authTime;
      }
    }
  },
  'hydrator-oauth_code_10000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, oauth_client_358, oauth_client_359, user_360, user_361, convertToJSValue_scope, convertToDatabaseValue_scope) {
    // compiled hydrator for entity OAuthCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.codeHash === null) {
        entity.codeHash = null;
      } else if (typeof data.codeHash !== 'undefined') {
        entity.codeHash = data.codeHash;
      }
      if (data.client === null) {
        entity.client = null;
      } else if (typeof data.client !== 'undefined') {
        if (isPrimaryKey(data.client, true)) {
          entity.client = factory.createReference(oauth_client_358, data.client, { merge: true, convertCustomTypes, normalizeAccessors, schema });
        } else if (data.client && typeof data.client === 'object') {
          entity.client = factory.create(oauth_client_359, data.client, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema });
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_360, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_361, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.redirectUri === null) {
        entity.redirectUri = null;
      } else if (typeof data.redirectUri !== 'undefined') {
        entity.redirectUri = data.redirectUri;
      }
      if (data.scope === null) {
        entity.scope = null;
      } else if (typeof data.scope !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scope(data.scope);
          data.scope = convertToDatabaseValue_scope(value);
          entity.scope = value;
        } else {
          entity.scope = data.scope;
        }
      }
      if (data.nonce === null) {
        entity.nonce = null;
      } else if (typeof data.nonce !== 'undefined') {
        entity.nonce = data.nonce;
      }
      if (data.codeChallenge === null) {
        entity.codeChallenge = null;
      } else if (typeof data.codeChallenge !== 'undefined') {
        entity.codeChallenge = data.codeChallenge;
      }
      if (data.codeChallengeMethod === null) {
        entity.codeChallengeMethod = null;
      } else if (typeof data.codeChallengeMethod !== 'undefined') {
        entity.codeChallengeMethod = data.codeChallengeMethod;
      }
      if (data.expiredAt === null) {
        entity.expiredAt = null;
      } else if (typeof data.expiredAt !== 'undefined') {
        if (data.expiredAt instanceof Date) {
          entity.expiredAt = data.expiredAt;
        } else if (typeof data.expiredAt === 'number' || data.expiredAt.includes('+') || data.expiredAt.lastIndexOf('-') > 10 || data.expiredAt.endsWith('Z')) {
          entity.expiredAt = new Date(data.expiredAt);
        } else {
          entity.expiredAt = new Date(data.expiredAt + 'Z');
        }
      }
      if (data.consumedAt === null) {
        entity.consumedAt = null;
      } else if (typeof data.consumedAt !== 'undefined') {
        if (data.consumedAt instanceof Date) {
          entity.consumedAt = data.consumedAt;
        } else if (typeof data.consumedAt === 'number' || data.consumedAt.includes('+') || data.consumedAt.lastIndexOf('-') > 10 || data.consumedAt.endsWith('Z')) {
          entity.consumedAt = new Date(data.consumedAt);
        } else {
          entity.consumedAt = new Date(data.consumedAt + 'Z');
        }
      }
      if (data.authTime === null) {
        entity.authTime = null;
      } else if (typeof data.authTime !== 'undefined') {
        entity.authTime = data.authTime;
      }
    }
  },
  'comparator-oauth_code_10000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity OAuthCodeEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.codeHash === null && last.codeHash === undefined) {
        diff.codeHash = current.codeHash;
      } else if (current.codeHash == null && last.codeHash == null) {

      } else if ((current.codeHash != null && last.codeHash == null) || (current.codeHash == null && last.codeHash != null)) {
        diff.codeHash = current.codeHash;
      } else if (last.codeHash !== current.codeHash) {
        diff.codeHash = current.codeHash;
      }

      if (current.client === null && last.client === undefined) {
        diff.client = current.client;
      } else if (current.client == null && last.client == null) {

      } else if ((current.client != null && last.client == null) || (current.client == null && last.client != null)) {
        diff.client = current.client;
      } else if (last.client !== current.client) {
        diff.client = current.client;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.redirectUri === null && last.redirectUri === undefined) {
        diff.redirectUri = current.redirectUri;
      } else if (current.redirectUri == null && last.redirectUri == null) {

      } else if ((current.redirectUri != null && last.redirectUri == null) || (current.redirectUri == null && last.redirectUri != null)) {
        diff.redirectUri = current.redirectUri;
      } else if (last.redirectUri !== current.redirectUri) {
        diff.redirectUri = current.redirectUri;
      }

      if (current.scope === null && last.scope === undefined) {
        diff.scope = current.scope;
      } else if (current.scope == null && last.scope == null) {

      } else if ((current.scope != null && last.scope == null) || (current.scope == null && last.scope != null)) {
        diff.scope = current.scope;
      } else if (!equals(last.scope, current.scope)) {
        diff.scope = current.scope;
      }

      if (current.nonce === null && last.nonce === undefined) {
        diff.nonce = current.nonce;
      } else if (current.nonce == null && last.nonce == null) {

      } else if ((current.nonce != null && last.nonce == null) || (current.nonce == null && last.nonce != null)) {
        diff.nonce = current.nonce;
      } else if (last.nonce !== current.nonce) {
        diff.nonce = current.nonce;
      }

      if (current.codeChallenge === null && last.codeChallenge === undefined) {
        diff.codeChallenge = current.codeChallenge;
      } else if (current.codeChallenge == null && last.codeChallenge == null) {

      } else if ((current.codeChallenge != null && last.codeChallenge == null) || (current.codeChallenge == null && last.codeChallenge != null)) {
        diff.codeChallenge = current.codeChallenge;
      } else if (last.codeChallenge !== current.codeChallenge) {
        diff.codeChallenge = current.codeChallenge;
      }

      if (current.codeChallengeMethod === null && last.codeChallengeMethod === undefined) {
        diff.codeChallengeMethod = current.codeChallengeMethod;
      } else if (current.codeChallengeMethod == null && last.codeChallengeMethod == null) {

      } else if ((current.codeChallengeMethod != null && last.codeChallengeMethod == null) || (current.codeChallengeMethod == null && last.codeChallengeMethod != null)) {
        diff.codeChallengeMethod = current.codeChallengeMethod;
      } else if (last.codeChallengeMethod !== current.codeChallengeMethod) {
        diff.codeChallengeMethod = current.codeChallengeMethod;
      }

      if (current.expiredAt === null && last.expiredAt === undefined) {
        diff.expiredAt = current.expiredAt;
      } else if (current.expiredAt == null && last.expiredAt == null) {

      } else if ((current.expiredAt != null && last.expiredAt == null) || (current.expiredAt == null && last.expiredAt != null)) {
        diff.expiredAt = current.expiredAt;
      } else if (last.expiredAt.valueOf() !== current.expiredAt.valueOf()) {
        diff.expiredAt = current.expiredAt;
      }

      if (current.consumedAt === null && last.consumedAt === undefined) {
        diff.consumedAt = current.consumedAt;
      } else if (current.consumedAt == null && last.consumedAt == null) {

      } else if ((current.consumedAt != null && last.consumedAt == null) || (current.consumedAt == null && last.consumedAt != null)) {
        diff.consumedAt = current.consumedAt;
      } else if (last.consumedAt.valueOf() !== current.consumedAt.valueOf()) {
        diff.consumedAt = current.consumedAt;
      }

      if (current.authTime === null && last.authTime === undefined) {
        diff.authTime = current.authTime;
      } else if (current.authTime == null && last.authTime == null) {

      } else if ((current.authTime != null && last.authTime == null) || (current.authTime == null && last.authTime != null)) {
        diff.authTime = current.authTime;
      } else if (!equals(last.authTime, current.authTime)) {
        diff.authTime = current.authTime;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-oauth_code_10000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier, convertToDatabaseValue_scope) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.codeHash !== 'undefined') {
        ret.codeHash = entity.codeHash;
      }

      if (typeof entity.client !== 'undefined') {
        if (entity.client === null) {
          ret.client = null;
        } else if (entity.client?.__helper.__identifier && !entity.client.__helper.hasPrimaryKey()) {
          ret.client = entity.client?.__helper.__identifier;
        } else if (typeof entity.client !== 'undefined') {
          ret.client = toArray(entity.client.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.redirectUri !== 'undefined') {
        ret.redirectUri = entity.redirectUri;
      }

      if (typeof entity.scope !== 'undefined') {
        ret.scope = clone(convertToDatabaseValue_scope(entity.scope));
      }

      if (typeof entity.nonce !== 'undefined') {
        ret.nonce = entity.nonce;
      }

      if (typeof entity.codeChallenge !== 'undefined') {
        ret.codeChallenge = entity.codeChallenge;
      }

      if (typeof entity.codeChallengeMethod !== 'undefined') {
        ret.codeChallengeMethod = entity.codeChallengeMethod;
      }

      if (typeof entity.expiredAt !== 'undefined') {
        ret.expiredAt = clone(processDateProperty(entity.expiredAt));
      }

      if (typeof entity.consumedAt !== 'undefined') {
        ret.consumedAt = clone(processDateProperty(entity.consumedAt));
      }

      if (typeof entity.authTime !== 'undefined') {
        ret.authTime = clone(entity.authTime);
      }

      return ret;
    }
  },
  'resultMapper-oauth_code_10000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity OAuthCodeEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.code_hash !== 'undefined') {
        ret.codeHash = result.code_hash;
        mapped.code_hash = true;
      }
      if (typeof result.client_id !== 'undefined') {
        ret.client = result.client_id;
        mapped.client_id = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.redirect_uri !== 'undefined') {
        ret.redirectUri = result.redirect_uri;
        mapped.redirect_uri = true;
      }
      if (typeof result.scope !== 'undefined') {
        ret.scope = result.scope;
        mapped.scope = true;
      }
      if (typeof result.nonce !== 'undefined') {
        ret.nonce = result.nonce;
        mapped.nonce = true;
      }
      if (typeof result.code_challenge !== 'undefined') {
        ret.codeChallenge = result.code_challenge;
        mapped.code_challenge = true;
      }
      if (typeof result.code_challenge_method !== 'undefined') {
        ret.codeChallengeMethod = result.code_challenge_method;
        mapped.code_challenge_method = true;
      }
      if (typeof result.expired_at !== 'undefined') {
        if (result.expired_at == null || result.expired_at instanceof Date) {
          ret.expiredAt = result.expired_at;
        } else if (typeof result.expired_at === 'bigint') {
          ret.expiredAt = parseDate(Number(result.expired_at));
        } else if (typeof result.expired_at === 'number' || result.expired_at.includes('+') || result.expired_at.lastIndexOf('-') > 10 || result.expired_at.endsWith('Z')) {
          ret.expiredAt = parseDate(result.expired_at);
        } else {
          ret.expiredAt = parseDate(result.expired_at + 'Z');
        }
        mapped.expired_at = true;
      }
      if (typeof result.consumed_at !== 'undefined') {
        if (result.consumed_at == null || result.consumed_at instanceof Date) {
          ret.consumedAt = result.consumed_at;
        } else if (typeof result.consumed_at === 'bigint') {
          ret.consumedAt = parseDate(Number(result.consumed_at));
        } else if (typeof result.consumed_at === 'number' || result.consumed_at.includes('+') || result.consumed_at.lastIndexOf('-') > 10 || result.consumed_at.endsWith('Z')) {
          ret.consumedAt = parseDate(result.consumed_at);
        } else {
          ret.consumedAt = parseDate(result.consumed_at + 'Z');
        }
        mapped.consumed_at = true;
      }
      if (typeof result.auth_time !== 'undefined') {
        ret.authTime = result.auth_time;
        mapped.auth_time = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-oauth_code_10000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity OAuthCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-oauth_code_10000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity OAuthCodeEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-oauth_code_10000': function(isEntityOrRef) {
    // compiled pk getter for entity OAuthCodeEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-oauth_code_10000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity OAuthCodeEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-oauth_code_10000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity OAuthCodeEntity
    return function(entity) {
      const val_12 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_12);
    }
  },
  'hydrator-oauth_client_14000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_grantTypes, convertToDatabaseValue_grantTypes, convertToJSValue_responseTypes, convertToDatabaseValue_responseTypes, convertToJSValue_scopes, convertToDatabaseValue_scopes, convertToJSValue_redirectUris, convertToDatabaseValue_redirectUris, convertToJSValue_postLogoutRedirectUris, convertToDatabaseValue_postLogoutRedirectUris, convertToJSValue_webOrigins, convertToDatabaseValue_webOrigins, oauth_code_388, oauth_device_code_389, user_consent_390, revoked_tokens_391) {
    // compiled hydrator for entity OAuthClientEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.clientId === null) {
        entity.clientId = null;
      } else if (typeof data.clientId !== 'undefined') {
        entity.clientId = data.clientId;
      }
      if (data.clientSecretHash === null) {
        entity.clientSecretHash = null;
      } else if (typeof data.clientSecretHash !== 'undefined') {
        entity.clientSecretHash = data.clientSecretHash;
      }
      if (data.name === null) {
        entity.name = null;
      } else if (typeof data.name !== 'undefined') {
        entity.name = data.name;
      }
      if (data.grantTypes === null) {
        entity.grantTypes = null;
      } else if (typeof data.grantTypes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_grantTypes(data.grantTypes);
          data.grantTypes = convertToDatabaseValue_grantTypes(value);
          entity.grantTypes = value;
        } else {
          entity.grantTypes = data.grantTypes;
        }
      }
      if (data.responseTypes === null) {
        entity.responseTypes = null;
      } else if (typeof data.responseTypes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_responseTypes(data.responseTypes);
          data.responseTypes = convertToDatabaseValue_responseTypes(value);
          entity.responseTypes = value;
        } else {
          entity.responseTypes = data.responseTypes;
        }
      }
      if (data.scopes === null) {
        entity.scopes = null;
      } else if (typeof data.scopes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scopes(data.scopes);
          data.scopes = convertToDatabaseValue_scopes(value);
          entity.scopes = value;
        } else {
          entity.scopes = data.scopes;
        }
      }
      if (data.redirectUris === null) {
        entity.redirectUris = null;
      } else if (typeof data.redirectUris !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_redirectUris(data.redirectUris);
          data.redirectUris = convertToDatabaseValue_redirectUris(value);
          entity.redirectUris = value;
        } else {
          entity.redirectUris = data.redirectUris;
        }
      }
      if (data.postLogoutRedirectUris === null) {
        entity.postLogoutRedirectUris = null;
      } else if (typeof data.postLogoutRedirectUris !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_postLogoutRedirectUris(data.postLogoutRedirectUris);
          data.postLogoutRedirectUris = convertToDatabaseValue_postLogoutRedirectUris(value);
          entity.postLogoutRedirectUris = value;
        } else {
          entity.postLogoutRedirectUris = data.postLogoutRedirectUris;
        }
      }
      if (data.webOrigins === null) {
        entity.webOrigins = null;
      } else if (typeof data.webOrigins !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_webOrigins(data.webOrigins);
          data.webOrigins = convertToDatabaseValue_webOrigins(value);
          entity.webOrigins = value;
        } else {
          entity.webOrigins = data.webOrigins;
        }
      }
      if (data.enabled === null) {
        entity.enabled = null;
      } else if (typeof data.enabled !== 'undefined') {
        entity.enabled = !!data.enabled;
      }
      if (data.skipConsent === null) {
        entity.skipConsent = null;
      } else if (typeof data.skipConsent !== 'undefined') {
        entity.skipConsent = !!data.skipConsent;
      }
      if (data.managed_by === null) {
        entity.managed_by = null;
      } else if (typeof data.managed_by !== 'undefined') {
        entity.managed_by = data.managed_by;
      }
      if (data.logoUri === null) {
        entity.logoUri = null;
      } else if (typeof data.logoUri !== 'undefined') {
        entity.logoUri = data.logoUri;
      }
      const createCollectionItem_codes = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(oauth_code_388, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(oauth_code_388, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.codes && !Array.isArray(data.codes) && typeof data.codes === 'object') {
        data.codes = [data.codes];
      }
      if (Array.isArray(data.codes)) {
        const items = data.codes.map(value => createCollectionItem_codes(value, entity));
        const coll = Collection.create(entity, 'codes', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.codes && data.codes instanceof Collection) {
        entity.codes = data.codes;
      } else if (!entity.codes) {
        const coll = Collection.create(entity, 'codes', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_deviceCodes = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(oauth_device_code_389, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(oauth_device_code_389, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.deviceCodes && !Array.isArray(data.deviceCodes) && typeof data.deviceCodes === 'object') {
        data.deviceCodes = [data.deviceCodes];
      }
      if (Array.isArray(data.deviceCodes)) {
        const items = data.deviceCodes.map(value => createCollectionItem_deviceCodes(value, entity));
        const coll = Collection.create(entity, 'deviceCodes', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.deviceCodes && data.deviceCodes instanceof Collection) {
        entity.deviceCodes = data.deviceCodes;
      } else if (!entity.deviceCodes) {
        const coll = Collection.create(entity, 'deviceCodes', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_consents = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_consent_390, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_consent_390, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.consents && !Array.isArray(data.consents) && typeof data.consents === 'object') {
        data.consents = [data.consents];
      }
      if (Array.isArray(data.consents)) {
        const items = data.consents.map(value => createCollectionItem_consents(value, entity));
        const coll = Collection.create(entity, 'consents', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.consents && data.consents instanceof Collection) {
        entity.consents = data.consents;
      } else if (!entity.consents) {
        const coll = Collection.create(entity, 'consents', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_revokedTokens = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(revoked_tokens_391, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(revoked_tokens_391, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.revokedTokens && !Array.isArray(data.revokedTokens) && typeof data.revokedTokens === 'object') {
        data.revokedTokens = [data.revokedTokens];
      }
      if (Array.isArray(data.revokedTokens)) {
        const items = data.revokedTokens.map(value => createCollectionItem_revokedTokens(value, entity));
        const coll = Collection.create(entity, 'revokedTokens', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.revokedTokens && data.revokedTokens instanceof Collection) {
        entity.revokedTokens = data.revokedTokens;
      } else if (!entity.revokedTokens) {
        const coll = Collection.create(entity, 'revokedTokens', undefined, newEntity);
        coll.setDirty(false);
      }
    }
  },
  'hydrator-oauth_client_14000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_grantTypes, convertToDatabaseValue_grantTypes, convertToJSValue_responseTypes, convertToDatabaseValue_responseTypes, convertToJSValue_scopes, convertToDatabaseValue_scopes, convertToJSValue_redirectUris, convertToDatabaseValue_redirectUris, convertToJSValue_postLogoutRedirectUris, convertToDatabaseValue_postLogoutRedirectUris, convertToJSValue_webOrigins, convertToDatabaseValue_webOrigins, oauth_code_408, oauth_device_code_409, user_consent_410, revoked_tokens_411) {
    // compiled hydrator for entity OAuthClientEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.clientId === null) {
        entity.clientId = null;
      } else if (typeof data.clientId !== 'undefined') {
        entity.clientId = data.clientId;
      }
      if (data.clientSecretHash === null) {
        entity.clientSecretHash = null;
      } else if (typeof data.clientSecretHash !== 'undefined') {
        entity.clientSecretHash = data.clientSecretHash;
      }
      if (data.name === null) {
        entity.name = null;
      } else if (typeof data.name !== 'undefined') {
        entity.name = data.name;
      }
      if (data.grantTypes === null) {
        entity.grantTypes = null;
      } else if (typeof data.grantTypes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_grantTypes(data.grantTypes);
          data.grantTypes = convertToDatabaseValue_grantTypes(value);
          entity.grantTypes = value;
        } else {
          entity.grantTypes = data.grantTypes;
        }
      }
      if (data.responseTypes === null) {
        entity.responseTypes = null;
      } else if (typeof data.responseTypes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_responseTypes(data.responseTypes);
          data.responseTypes = convertToDatabaseValue_responseTypes(value);
          entity.responseTypes = value;
        } else {
          entity.responseTypes = data.responseTypes;
        }
      }
      if (data.scopes === null) {
        entity.scopes = null;
      } else if (typeof data.scopes !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_scopes(data.scopes);
          data.scopes = convertToDatabaseValue_scopes(value);
          entity.scopes = value;
        } else {
          entity.scopes = data.scopes;
        }
      }
      if (data.redirectUris === null) {
        entity.redirectUris = null;
      } else if (typeof data.redirectUris !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_redirectUris(data.redirectUris);
          data.redirectUris = convertToDatabaseValue_redirectUris(value);
          entity.redirectUris = value;
        } else {
          entity.redirectUris = data.redirectUris;
        }
      }
      if (data.postLogoutRedirectUris === null) {
        entity.postLogoutRedirectUris = null;
      } else if (typeof data.postLogoutRedirectUris !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_postLogoutRedirectUris(data.postLogoutRedirectUris);
          data.postLogoutRedirectUris = convertToDatabaseValue_postLogoutRedirectUris(value);
          entity.postLogoutRedirectUris = value;
        } else {
          entity.postLogoutRedirectUris = data.postLogoutRedirectUris;
        }
      }
      if (data.webOrigins === null) {
        entity.webOrigins = null;
      } else if (typeof data.webOrigins !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_webOrigins(data.webOrigins);
          data.webOrigins = convertToDatabaseValue_webOrigins(value);
          entity.webOrigins = value;
        } else {
          entity.webOrigins = data.webOrigins;
        }
      }
      if (data.enabled === null) {
        entity.enabled = null;
      } else if (typeof data.enabled !== 'undefined') {
        entity.enabled = !!data.enabled;
      }
      if (data.skipConsent === null) {
        entity.skipConsent = null;
      } else if (typeof data.skipConsent !== 'undefined') {
        entity.skipConsent = !!data.skipConsent;
      }
      if (data.managed_by === null) {
        entity.managed_by = null;
      } else if (typeof data.managed_by !== 'undefined') {
        entity.managed_by = data.managed_by;
      }
      if (data.logoUri === null) {
        entity.logoUri = null;
      } else if (typeof data.logoUri !== 'undefined') {
        entity.logoUri = data.logoUri;
      }
      const createCollectionItem_codes = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(oauth_code_408, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(oauth_code_408, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.codes && !Array.isArray(data.codes) && typeof data.codes === 'object') {
        data.codes = [data.codes];
      }
      if (Array.isArray(data.codes)) {
        const items = data.codes.map(value => createCollectionItem_codes(value, entity));
        const coll = Collection.create(entity, 'codes', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.codes && data.codes instanceof Collection) {
        entity.codes = data.codes;
      } else if (!entity.codes) {
        const coll = Collection.create(entity, 'codes', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_deviceCodes = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(oauth_device_code_409, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(oauth_device_code_409, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.deviceCodes && !Array.isArray(data.deviceCodes) && typeof data.deviceCodes === 'object') {
        data.deviceCodes = [data.deviceCodes];
      }
      if (Array.isArray(data.deviceCodes)) {
        const items = data.deviceCodes.map(value => createCollectionItem_deviceCodes(value, entity));
        const coll = Collection.create(entity, 'deviceCodes', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.deviceCodes && data.deviceCodes instanceof Collection) {
        entity.deviceCodes = data.deviceCodes;
      } else if (!entity.deviceCodes) {
        const coll = Collection.create(entity, 'deviceCodes', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_consents = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(user_consent_410, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(user_consent_410, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.consents && !Array.isArray(data.consents) && typeof data.consents === 'object') {
        data.consents = [data.consents];
      }
      if (Array.isArray(data.consents)) {
        const items = data.consents.map(value => createCollectionItem_consents(value, entity));
        const coll = Collection.create(entity, 'consents', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.consents && data.consents instanceof Collection) {
        entity.consents = data.consents;
      } else if (!entity.consents) {
        const coll = Collection.create(entity, 'consents', undefined, newEntity);
        coll.setDirty(false);
      }
      const createCollectionItem_revokedTokens = (value, entity) => {
        if (isPrimaryKey(value, false)) return factory.createReference(revoked_tokens_411, value, { convertCustomTypes, schema, normalizeAccessors, merge: true });
        if (value && isEntity(value)) return value;
        return factory.create(revoked_tokens_411, value, { newEntity, convertCustomTypes, schema, normalizeAccessors, merge: true });
      }
      if (data.revokedTokens && !Array.isArray(data.revokedTokens) && typeof data.revokedTokens === 'object') {
        data.revokedTokens = [data.revokedTokens];
      }
      if (Array.isArray(data.revokedTokens)) {
        const items = data.revokedTokens.map(value => createCollectionItem_revokedTokens(value, entity));
        const coll = Collection.create(entity, 'revokedTokens', items, newEntity);
        if (newEntity) {
          coll.setDirty();
        } else {
          coll.takeSnapshot(true);
        }
      } else if (!entity.revokedTokens && data.revokedTokens instanceof Collection) {
        entity.revokedTokens = data.revokedTokens;
      } else if (!entity.revokedTokens) {
        const coll = Collection.create(entity, 'revokedTokens', undefined, newEntity);
        coll.setDirty(false);
      }
    }
  },
  'comparator-oauth_client_14000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity OAuthClientEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.clientId === null && last.clientId === undefined) {
        diff.clientId = current.clientId;
      } else if (current.clientId == null && last.clientId == null) {

      } else if ((current.clientId != null && last.clientId == null) || (current.clientId == null && last.clientId != null)) {
        diff.clientId = current.clientId;
      } else if (last.clientId !== current.clientId) {
        diff.clientId = current.clientId;
      }

      if (current.clientSecretHash === null && last.clientSecretHash === undefined) {
        diff.clientSecretHash = current.clientSecretHash;
      } else if (current.clientSecretHash == null && last.clientSecretHash == null) {

      } else if ((current.clientSecretHash != null && last.clientSecretHash == null) || (current.clientSecretHash == null && last.clientSecretHash != null)) {
        diff.clientSecretHash = current.clientSecretHash;
      } else if (last.clientSecretHash !== current.clientSecretHash) {
        diff.clientSecretHash = current.clientSecretHash;
      }

      if (current.name === null && last.name === undefined) {
        diff.name = current.name;
      } else if (current.name == null && last.name == null) {

      } else if ((current.name != null && last.name == null) || (current.name == null && last.name != null)) {
        diff.name = current.name;
      } else if (last.name !== current.name) {
        diff.name = current.name;
      }

      if (current.grantTypes === null && last.grantTypes === undefined) {
        diff.grantTypes = current.grantTypes;
      } else if (current.grantTypes == null && last.grantTypes == null) {

      } else if ((current.grantTypes != null && last.grantTypes == null) || (current.grantTypes == null && last.grantTypes != null)) {
        diff.grantTypes = current.grantTypes;
      } else if (!equals(last.grantTypes, current.grantTypes)) {
        diff.grantTypes = current.grantTypes;
      }

      if (current.responseTypes === null && last.responseTypes === undefined) {
        diff.responseTypes = current.responseTypes;
      } else if (current.responseTypes == null && last.responseTypes == null) {

      } else if ((current.responseTypes != null && last.responseTypes == null) || (current.responseTypes == null && last.responseTypes != null)) {
        diff.responseTypes = current.responseTypes;
      } else if (!equals(last.responseTypes, current.responseTypes)) {
        diff.responseTypes = current.responseTypes;
      }

      if (current.scopes === null && last.scopes === undefined) {
        diff.scopes = current.scopes;
      } else if (current.scopes == null && last.scopes == null) {

      } else if ((current.scopes != null && last.scopes == null) || (current.scopes == null && last.scopes != null)) {
        diff.scopes = current.scopes;
      } else if (!equals(last.scopes, current.scopes)) {
        diff.scopes = current.scopes;
      }

      if (current.redirectUris === null && last.redirectUris === undefined) {
        diff.redirectUris = current.redirectUris;
      } else if (current.redirectUris == null && last.redirectUris == null) {

      } else if ((current.redirectUris != null && last.redirectUris == null) || (current.redirectUris == null && last.redirectUris != null)) {
        diff.redirectUris = current.redirectUris;
      } else if (!equals(last.redirectUris, current.redirectUris)) {
        diff.redirectUris = current.redirectUris;
      }

      if (current.postLogoutRedirectUris === null && last.postLogoutRedirectUris === undefined) {
        diff.postLogoutRedirectUris = current.postLogoutRedirectUris;
      } else if (current.postLogoutRedirectUris == null && last.postLogoutRedirectUris == null) {

      } else if ((current.postLogoutRedirectUris != null && last.postLogoutRedirectUris == null) || (current.postLogoutRedirectUris == null && last.postLogoutRedirectUris != null)) {
        diff.postLogoutRedirectUris = current.postLogoutRedirectUris;
      } else if (!equals(last.postLogoutRedirectUris, current.postLogoutRedirectUris)) {
        diff.postLogoutRedirectUris = current.postLogoutRedirectUris;
      }

      if (current.webOrigins === null && last.webOrigins === undefined) {
        diff.webOrigins = current.webOrigins;
      } else if (current.webOrigins == null && last.webOrigins == null) {

      } else if ((current.webOrigins != null && last.webOrigins == null) || (current.webOrigins == null && last.webOrigins != null)) {
        diff.webOrigins = current.webOrigins;
      } else if (!equals(last.webOrigins, current.webOrigins)) {
        diff.webOrigins = current.webOrigins;
      }

      if (current.enabled === null && last.enabled === undefined) {
        diff.enabled = current.enabled;
      } else if (current.enabled == null && last.enabled == null) {

      } else if ((current.enabled != null && last.enabled == null) || (current.enabled == null && last.enabled != null)) {
        diff.enabled = current.enabled;
      } else if (!compareBooleans(last.enabled, current.enabled)) {
        diff.enabled = current.enabled;
      }

      if (current.skipConsent === null && last.skipConsent === undefined) {
        diff.skipConsent = current.skipConsent;
      } else if (current.skipConsent == null && last.skipConsent == null) {

      } else if ((current.skipConsent != null && last.skipConsent == null) || (current.skipConsent == null && last.skipConsent != null)) {
        diff.skipConsent = current.skipConsent;
      } else if (!compareBooleans(last.skipConsent, current.skipConsent)) {
        diff.skipConsent = current.skipConsent;
      }

      if (current.managed_by === null && last.managed_by === undefined) {
        diff.managed_by = current.managed_by;
      } else if (current.managed_by == null && last.managed_by == null) {

      } else if ((current.managed_by != null && last.managed_by == null) || (current.managed_by == null && last.managed_by != null)) {
        diff.managed_by = current.managed_by;
      } else if (last.managed_by !== current.managed_by) {
        diff.managed_by = current.managed_by;
      }

      if (current.logoUri === null && last.logoUri === undefined) {
        diff.logoUri = current.logoUri;
      } else if (current.logoUri == null && last.logoUri == null) {

      } else if ((current.logoUri != null && last.logoUri == null) || (current.logoUri == null && last.logoUri != null)) {
        diff.logoUri = current.logoUri;
      } else if (last.logoUri !== current.logoUri) {
        diff.logoUri = current.logoUri;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-oauth_client_14000': function(clone, cloneEmbeddable, processDateProperty, convertToDatabaseValue_grantTypes, convertToDatabaseValue_responseTypes, convertToDatabaseValue_scopes, convertToDatabaseValue_redirectUris, convertToDatabaseValue_postLogoutRedirectUris, convertToDatabaseValue_webOrigins) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = entity.id;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.clientId !== 'undefined') {
        ret.clientId = entity.clientId;
      }

      if (typeof entity.clientSecretHash !== 'undefined') {
        ret.clientSecretHash = entity.clientSecretHash;
      }

      if (typeof entity.name !== 'undefined') {
        ret.name = entity.name;
      }

      if (typeof entity.grantTypes !== 'undefined') {
        ret.grantTypes = clone(convertToDatabaseValue_grantTypes(entity.grantTypes));
      }

      if (typeof entity.responseTypes !== 'undefined') {
        ret.responseTypes = clone(convertToDatabaseValue_responseTypes(entity.responseTypes));
      }

      if (typeof entity.scopes !== 'undefined') {
        ret.scopes = clone(convertToDatabaseValue_scopes(entity.scopes));
      }

      if (typeof entity.redirectUris !== 'undefined') {
        ret.redirectUris = clone(convertToDatabaseValue_redirectUris(entity.redirectUris));
      }

      if (typeof entity.postLogoutRedirectUris !== 'undefined') {
        ret.postLogoutRedirectUris = clone(convertToDatabaseValue_postLogoutRedirectUris(entity.postLogoutRedirectUris));
      }

      if (typeof entity.webOrigins !== 'undefined') {
        ret.webOrigins = clone(convertToDatabaseValue_webOrigins(entity.webOrigins));
      }

      if (typeof entity.enabled !== 'undefined') {
        ret.enabled = entity.enabled;
      }

      if (typeof entity.skipConsent !== 'undefined') {
        ret.skipConsent = entity.skipConsent;
      }

      if (typeof entity.managed_by !== 'undefined') {
        ret.managed_by = entity.managed_by;
      }

      if (typeof entity.logoUri !== 'undefined') {
        ret.logoUri = entity.logoUri;
      }

      return ret;
    }
  },
  'resultMapper-oauth_client_14000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity OAuthClientEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.client_id !== 'undefined') {
        ret.clientId = result.client_id;
        mapped.client_id = true;
      }
      if (typeof result.client_secret_hash !== 'undefined') {
        ret.clientSecretHash = result.client_secret_hash;
        mapped.client_secret_hash = true;
      }
      if (typeof result.name !== 'undefined') {
        ret.name = result.name;
        mapped.name = true;
      }
      if (typeof result.grant_types !== 'undefined') {
        ret.grantTypes = result.grant_types;
        mapped.grant_types = true;
      }
      if (typeof result.response_types !== 'undefined') {
        ret.responseTypes = result.response_types;
        mapped.response_types = true;
      }
      if (typeof result.scopes !== 'undefined') {
        ret.scopes = result.scopes;
        mapped.scopes = true;
      }
      if (typeof result.redirect_uris !== 'undefined') {
        ret.redirectUris = result.redirect_uris;
        mapped.redirect_uris = true;
      }
      if (typeof result.post_logout_redirect_uris !== 'undefined') {
        ret.postLogoutRedirectUris = result.post_logout_redirect_uris;
        mapped.post_logout_redirect_uris = true;
      }
      if (typeof result.web_origins !== 'undefined') {
        ret.webOrigins = result.web_origins;
        mapped.web_origins = true;
      }
      if (typeof result.enabled !== 'undefined') {
        ret.enabled = result.enabled == null ? result.enabled : !!result.enabled;
        mapped.enabled = true;
      }
      if (typeof result.skip_consent !== 'undefined') {
        ret.skipConsent = result.skip_consent == null ? result.skip_consent : !!result.skip_consent;
        mapped.skip_consent = true;
      }
      if (typeof result.managed_by !== 'undefined') {
        ret.managed_by = result.managed_by;
        mapped.managed_by = true;
      }
      if (typeof result.logo_uri !== 'undefined') {
        ret.logoUri = result.logo_uri;
        mapped.logo_uri = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-oauth_client_14000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity OAuthClientEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'hydrator-oauth_client_14000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity OAuthClientEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'pkGetter-oauth_client_14000': function(isEntityOrRef) {
    // compiled pk getter for entity OAuthClientEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-oauth_client_14000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity OAuthClientEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkSerializer-oauth_client_14000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity OAuthClientEntity
    return function(entity) {
      return '' + entity.id;
    }
  },
  'hydrator-jwt_key_9000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity JwtKeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.kid === null) {
        entity.kid = null;
      } else if (typeof data.kid !== 'undefined') {
        entity.kid = data.kid;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.private_key === null) {
        entity.private_key = null;
      } else if (typeof data.private_key !== 'undefined') {
        entity.private_key = data.private_key;
      }
      if (data.public_key === null) {
        entity.public_key = null;
      } else if (typeof data.public_key !== 'undefined') {
        entity.public_key = data.public_key;
      }
      if (data.algorithm === null) {
        entity.algorithm = null;
      } else if (typeof data.algorithm !== 'undefined') {
        entity.algorithm = data.algorithm;
      }
      if (data.status === null) {
        entity.status = null;
      } else if (typeof data.status !== 'undefined') {
        entity.status = data.status;
      }
      if (data.activated_at === null) {
        entity.activated_at = null;
      } else if (typeof data.activated_at !== 'undefined') {
        if (data.activated_at instanceof Date) {
          entity.activated_at = data.activated_at;
        } else if (typeof data.activated_at === 'number' || data.activated_at.includes('+') || data.activated_at.lastIndexOf('-') > 10 || data.activated_at.endsWith('Z')) {
          entity.activated_at = new Date(data.activated_at);
        } else {
          entity.activated_at = new Date(data.activated_at + 'Z');
        }
      }
      if (data.deactivated_at === null) {
        entity.deactivated_at = null;
      } else if (typeof data.deactivated_at !== 'undefined') {
        if (data.deactivated_at instanceof Date) {
          entity.deactivated_at = data.deactivated_at;
        } else if (typeof data.deactivated_at === 'number' || data.deactivated_at.includes('+') || data.deactivated_at.lastIndexOf('-') > 10 || data.deactivated_at.endsWith('Z')) {
          entity.deactivated_at = new Date(data.deactivated_at);
        } else {
          entity.deactivated_at = new Date(data.deactivated_at + 'Z');
        }
      }
      if (data.retired_at === null) {
        entity.retired_at = null;
      } else if (typeof data.retired_at !== 'undefined') {
        if (data.retired_at instanceof Date) {
          entity.retired_at = data.retired_at;
        } else if (typeof data.retired_at === 'number' || data.retired_at.includes('+') || data.retired_at.lastIndexOf('-') > 10 || data.retired_at.endsWith('Z')) {
          entity.retired_at = new Date(data.retired_at);
        } else {
          entity.retired_at = new Date(data.retired_at + 'Z');
        }
      }
      if (data.expires_at === null) {
        entity.expires_at = null;
      } else if (typeof data.expires_at !== 'undefined') {
        if (data.expires_at instanceof Date) {
          entity.expires_at = data.expires_at;
        } else if (typeof data.expires_at === 'number' || data.expires_at.includes('+') || data.expires_at.lastIndexOf('-') > 10 || data.expires_at.endsWith('Z')) {
          entity.expires_at = new Date(data.expires_at);
        } else {
          entity.expires_at = new Date(data.expires_at + 'Z');
        }
      }
    }
  },
  'hydrator-jwt_key_9000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity JwtKeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.kid === null) {
        entity.kid = null;
      } else if (typeof data.kid !== 'undefined') {
        entity.kid = data.kid;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.private_key === null) {
        entity.private_key = null;
      } else if (typeof data.private_key !== 'undefined') {
        entity.private_key = data.private_key;
      }
      if (data.public_key === null) {
        entity.public_key = null;
      } else if (typeof data.public_key !== 'undefined') {
        entity.public_key = data.public_key;
      }
      if (data.algorithm === null) {
        entity.algorithm = null;
      } else if (typeof data.algorithm !== 'undefined') {
        entity.algorithm = data.algorithm;
      }
      if (data.status === null) {
        entity.status = null;
      } else if (typeof data.status !== 'undefined') {
        entity.status = data.status;
      }
      if (data.activated_at === null) {
        entity.activated_at = null;
      } else if (typeof data.activated_at !== 'undefined') {
        if (data.activated_at instanceof Date) {
          entity.activated_at = data.activated_at;
        } else if (typeof data.activated_at === 'number' || data.activated_at.includes('+') || data.activated_at.lastIndexOf('-') > 10 || data.activated_at.endsWith('Z')) {
          entity.activated_at = new Date(data.activated_at);
        } else {
          entity.activated_at = new Date(data.activated_at + 'Z');
        }
      }
      if (data.deactivated_at === null) {
        entity.deactivated_at = null;
      } else if (typeof data.deactivated_at !== 'undefined') {
        if (data.deactivated_at instanceof Date) {
          entity.deactivated_at = data.deactivated_at;
        } else if (typeof data.deactivated_at === 'number' || data.deactivated_at.includes('+') || data.deactivated_at.lastIndexOf('-') > 10 || data.deactivated_at.endsWith('Z')) {
          entity.deactivated_at = new Date(data.deactivated_at);
        } else {
          entity.deactivated_at = new Date(data.deactivated_at + 'Z');
        }
      }
      if (data.retired_at === null) {
        entity.retired_at = null;
      } else if (typeof data.retired_at !== 'undefined') {
        if (data.retired_at instanceof Date) {
          entity.retired_at = data.retired_at;
        } else if (typeof data.retired_at === 'number' || data.retired_at.includes('+') || data.retired_at.lastIndexOf('-') > 10 || data.retired_at.endsWith('Z')) {
          entity.retired_at = new Date(data.retired_at);
        } else {
          entity.retired_at = new Date(data.retired_at + 'Z');
        }
      }
      if (data.expires_at === null) {
        entity.expires_at = null;
      } else if (typeof data.expires_at !== 'undefined') {
        if (data.expires_at instanceof Date) {
          entity.expires_at = data.expires_at;
        } else if (typeof data.expires_at === 'number' || data.expires_at.includes('+') || data.expires_at.lastIndexOf('-') > 10 || data.expires_at.endsWith('Z')) {
          entity.expires_at = new Date(data.expires_at);
        } else {
          entity.expires_at = new Date(data.expires_at + 'Z');
        }
      }
    }
  },
  'comparator-jwt_key_9000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity JwtKeyEntity
    return function(last, current, options) {
      const diff = {};
      if (current.kid === null && last.kid === undefined) {
        diff.kid = current.kid;
      } else if (current.kid == null && last.kid == null) {

      } else if ((current.kid != null && last.kid == null) || (current.kid == null && last.kid != null)) {
        diff.kid = current.kid;
      } else if (last.kid !== current.kid) {
        diff.kid = current.kid;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.private_key === null && last.private_key === undefined) {
        diff.private_key = current.private_key;
      } else if (current.private_key == null && last.private_key == null) {

      } else if ((current.private_key != null && last.private_key == null) || (current.private_key == null && last.private_key != null)) {
        diff.private_key = current.private_key;
      } else if (!equals(last.private_key, current.private_key)) {
        diff.private_key = current.private_key;
      }

      if (current.public_key === null && last.public_key === undefined) {
        diff.public_key = current.public_key;
      } else if (current.public_key == null && last.public_key == null) {

      } else if ((current.public_key != null && last.public_key == null) || (current.public_key == null && last.public_key != null)) {
        diff.public_key = current.public_key;
      } else if (!equals(last.public_key, current.public_key)) {
        diff.public_key = current.public_key;
      }

      if (current.algorithm === null && last.algorithm === undefined) {
        diff.algorithm = current.algorithm;
      } else if (current.algorithm == null && last.algorithm == null) {

      } else if ((current.algorithm != null && last.algorithm == null) || (current.algorithm == null && last.algorithm != null)) {
        diff.algorithm = current.algorithm;
      } else if (last.algorithm !== current.algorithm) {
        diff.algorithm = current.algorithm;
      }

      if (current.status === null && last.status === undefined) {
        diff.status = current.status;
      } else if (current.status == null && last.status == null) {

      } else if ((current.status != null && last.status == null) || (current.status == null && last.status != null)) {
        diff.status = current.status;
      } else if (last.status !== current.status) {
        diff.status = current.status;
      }

      if (current.activated_at === null && last.activated_at === undefined) {
        diff.activated_at = current.activated_at;
      } else if (current.activated_at == null && last.activated_at == null) {

      } else if ((current.activated_at != null && last.activated_at == null) || (current.activated_at == null && last.activated_at != null)) {
        diff.activated_at = current.activated_at;
      } else if (last.activated_at.valueOf() !== current.activated_at.valueOf()) {
        diff.activated_at = current.activated_at;
      }

      if (current.deactivated_at === null && last.deactivated_at === undefined) {
        diff.deactivated_at = current.deactivated_at;
      } else if (current.deactivated_at == null && last.deactivated_at == null) {

      } else if ((current.deactivated_at != null && last.deactivated_at == null) || (current.deactivated_at == null && last.deactivated_at != null)) {
        diff.deactivated_at = current.deactivated_at;
      } else if (last.deactivated_at.valueOf() !== current.deactivated_at.valueOf()) {
        diff.deactivated_at = current.deactivated_at;
      }

      if (current.retired_at === null && last.retired_at === undefined) {
        diff.retired_at = current.retired_at;
      } else if (current.retired_at == null && last.retired_at == null) {

      } else if ((current.retired_at != null && last.retired_at == null) || (current.retired_at == null && last.retired_at != null)) {
        diff.retired_at = current.retired_at;
      } else if (last.retired_at.valueOf() !== current.retired_at.valueOf()) {
        diff.retired_at = current.retired_at;
      }

      if (current.expires_at === null && last.expires_at === undefined) {
        diff.expires_at = current.expires_at;
      } else if (current.expires_at == null && last.expires_at == null) {

      } else if ((current.expires_at != null && last.expires_at == null) || (current.expires_at == null && last.expires_at != null)) {
        diff.expires_at = current.expires_at;
      } else if (last.expires_at.valueOf() !== current.expires_at.valueOf()) {
        diff.expires_at = current.expires_at;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-jwt_key_9000': function(clone, cloneEmbeddable, processDateProperty) {
    return function(entity) {
      const ret = {};
      if (typeof entity.kid !== 'undefined') {
        ret.kid = entity.kid;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.private_key !== 'undefined') {
        ret.private_key = clone(entity.private_key);
      }

      if (typeof entity.public_key !== 'undefined') {
        ret.public_key = clone(entity.public_key);
      }

      if (typeof entity.algorithm !== 'undefined') {
        ret.algorithm = entity.algorithm;
      }

      if (typeof entity.status !== 'undefined') {
        ret.status = entity.status;
      }

      if (typeof entity.activated_at !== 'undefined') {
        ret.activated_at = clone(processDateProperty(entity.activated_at));
      }

      if (typeof entity.deactivated_at !== 'undefined') {
        ret.deactivated_at = clone(processDateProperty(entity.deactivated_at));
      }

      if (typeof entity.retired_at !== 'undefined') {
        ret.retired_at = clone(processDateProperty(entity.retired_at));
      }

      if (typeof entity.expires_at !== 'undefined') {
        ret.expires_at = clone(processDateProperty(entity.expires_at));
      }

      return ret;
    }
  },
  'resultMapper-jwt_key_9000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity JwtKeyEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.kid !== 'undefined') {
        ret.kid = result.kid;
        mapped.kid = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.private_key !== 'undefined') {
        ret.private_key = result.private_key;
        mapped.private_key = true;
      }
      if (typeof result.public_key !== 'undefined') {
        ret.public_key = result.public_key;
        mapped.public_key = true;
      }
      if (typeof result.algorithm !== 'undefined') {
        ret.algorithm = result.algorithm;
        mapped.algorithm = true;
      }
      if (typeof result.status !== 'undefined') {
        ret.status = result.status;
        mapped.status = true;
      }
      if (typeof result.activated_at !== 'undefined') {
        if (result.activated_at == null || result.activated_at instanceof Date) {
          ret.activated_at = result.activated_at;
        } else if (typeof result.activated_at === 'bigint') {
          ret.activated_at = parseDate(Number(result.activated_at));
        } else if (typeof result.activated_at === 'number' || result.activated_at.includes('+') || result.activated_at.lastIndexOf('-') > 10 || result.activated_at.endsWith('Z')) {
          ret.activated_at = parseDate(result.activated_at);
        } else {
          ret.activated_at = parseDate(result.activated_at + 'Z');
        }
        mapped.activated_at = true;
      }
      if (typeof result.deactivated_at !== 'undefined') {
        if (result.deactivated_at == null || result.deactivated_at instanceof Date) {
          ret.deactivated_at = result.deactivated_at;
        } else if (typeof result.deactivated_at === 'bigint') {
          ret.deactivated_at = parseDate(Number(result.deactivated_at));
        } else if (typeof result.deactivated_at === 'number' || result.deactivated_at.includes('+') || result.deactivated_at.lastIndexOf('-') > 10 || result.deactivated_at.endsWith('Z')) {
          ret.deactivated_at = parseDate(result.deactivated_at);
        } else {
          ret.deactivated_at = parseDate(result.deactivated_at + 'Z');
        }
        mapped.deactivated_at = true;
      }
      if (typeof result.retired_at !== 'undefined') {
        if (result.retired_at == null || result.retired_at instanceof Date) {
          ret.retired_at = result.retired_at;
        } else if (typeof result.retired_at === 'bigint') {
          ret.retired_at = parseDate(Number(result.retired_at));
        } else if (typeof result.retired_at === 'number' || result.retired_at.includes('+') || result.retired_at.lastIndexOf('-') > 10 || result.retired_at.endsWith('Z')) {
          ret.retired_at = parseDate(result.retired_at);
        } else {
          ret.retired_at = parseDate(result.retired_at + 'Z');
        }
        mapped.retired_at = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expires_at = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expires_at = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expires_at = parseDate(result.expires_at);
        } else {
          ret.expires_at = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-jwt_key_9000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity JwtKeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.kid === null) {
        entity.kid = null;
      } else if (typeof data.kid !== 'undefined') {
        entity.kid = data.kid;
      }
    }
  },
  'hydrator-jwt_key_9000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity JwtKeyEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.kid === null) {
        entity.kid = null;
      } else if (typeof data.kid !== 'undefined') {
        entity.kid = data.kid;
      }
    }
  },
  'pkGetter-jwt_key_9000': function(isEntityOrRef) {
    // compiled pk getter for entity JwtKeyEntity
    return function(entity) {
      return entity.kid;
    }
  },
  'pkGetterConverted-jwt_key_9000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity JwtKeyEntity
    return function(entity) {
      return entity.kid;
    }
  },
  'pkSerializer-jwt_key_9000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity JwtKeyEntity
    return function(entity) {
      return '' + entity.kid;
    }
  },
  'hydrator-email_verification_8000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_441, user_442) {
    // compiled hydrator for entity EmailVerificationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_441, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_442, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.token === null) {
        entity.token = null;
      } else if (typeof data.token !== 'undefined') {
        entity.token = data.token;
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
      if (data.verified === null) {
        entity.verified = null;
      } else if (typeof data.verified !== 'undefined') {
        entity.verified = !!data.verified;
      }
      if (data.verifiedAt === null) {
        entity.verifiedAt = null;
      } else if (typeof data.verifiedAt !== 'undefined') {
        if (data.verifiedAt instanceof Date) {
          entity.verifiedAt = data.verifiedAt;
        } else if (typeof data.verifiedAt === 'number' || data.verifiedAt.includes('+') || data.verifiedAt.lastIndexOf('-') > 10 || data.verifiedAt.endsWith('Z')) {
          entity.verifiedAt = new Date(data.verifiedAt);
        } else {
          entity.verifiedAt = new Date(data.verifiedAt + 'Z');
        }
      }
    }
  },
  'hydrator-email_verification_8000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id, user_450, user_451) {
    // compiled hydrator for entity EmailVerificationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.user === null) {
        entity.user = null;
      } else if (typeof data.user !== 'undefined') {
        if (isPrimaryKey(data.user, true)) {
          entity.user = Reference.create(factory.createReference(user_450, data.user, { merge: true, convertCustomTypes, normalizeAccessors, schema }));
        } else if (data.user && typeof data.user === 'object') {
          entity.user = Reference.create(factory.create(user_451, data.user, { initialized: true, merge: true, newEntity, convertCustomTypes, normalizeAccessors, schema }));
        }
      }
      if (data.token === null) {
        entity.token = null;
      } else if (typeof data.token !== 'undefined') {
        entity.token = data.token;
      }
      if (data.expiresAt === null) {
        entity.expiresAt = null;
      } else if (typeof data.expiresAt !== 'undefined') {
        if (data.expiresAt instanceof Date) {
          entity.expiresAt = data.expiresAt;
        } else if (typeof data.expiresAt === 'number' || data.expiresAt.includes('+') || data.expiresAt.lastIndexOf('-') > 10 || data.expiresAt.endsWith('Z')) {
          entity.expiresAt = new Date(data.expiresAt);
        } else {
          entity.expiresAt = new Date(data.expiresAt + 'Z');
        }
      }
      if (data.verified === null) {
        entity.verified = null;
      } else if (typeof data.verified !== 'undefined') {
        entity.verified = !!data.verified;
      }
      if (data.verifiedAt === null) {
        entity.verifiedAt = null;
      } else if (typeof data.verifiedAt !== 'undefined') {
        if (data.verifiedAt instanceof Date) {
          entity.verifiedAt = data.verifiedAt;
        } else if (typeof data.verifiedAt === 'number' || data.verifiedAt.includes('+') || data.verifiedAt.lastIndexOf('-') > 10 || data.verifiedAt.endsWith('Z')) {
          entity.verifiedAt = new Date(data.verifiedAt);
        } else {
          entity.verifiedAt = new Date(data.verifiedAt + 'Z');
        }
      }
    }
  },
  'comparator-email_verification_8000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity EmailVerificationEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.user === null && last.user === undefined) {
        diff.user = current.user;
      } else if (current.user == null && last.user == null) {

      } else if ((current.user != null && last.user == null) || (current.user == null && last.user != null)) {
        diff.user = current.user;
      } else if (last.user !== current.user) {
        diff.user = current.user;
      }

      if (current.token === null && last.token === undefined) {
        diff.token = current.token;
      } else if (current.token == null && last.token == null) {

      } else if ((current.token != null && last.token == null) || (current.token == null && last.token != null)) {
        diff.token = current.token;
      } else if (last.token !== current.token) {
        diff.token = current.token;
      }

      if (current.expiresAt === null && last.expiresAt === undefined) {
        diff.expiresAt = current.expiresAt;
      } else if (current.expiresAt == null && last.expiresAt == null) {

      } else if ((current.expiresAt != null && last.expiresAt == null) || (current.expiresAt == null && last.expiresAt != null)) {
        diff.expiresAt = current.expiresAt;
      } else if (last.expiresAt.valueOf() !== current.expiresAt.valueOf()) {
        diff.expiresAt = current.expiresAt;
      }

      if (current.verified === null && last.verified === undefined) {
        diff.verified = current.verified;
      } else if (current.verified == null && last.verified == null) {

      } else if ((current.verified != null && last.verified == null) || (current.verified == null && last.verified != null)) {
        diff.verified = current.verified;
      } else if (!compareBooleans(last.verified, current.verified)) {
        diff.verified = current.verified;
      }

      if (current.verifiedAt === null && last.verifiedAt === undefined) {
        diff.verifiedAt = current.verifiedAt;
      } else if (current.verifiedAt == null && last.verifiedAt == null) {

      } else if ((current.verifiedAt != null && last.verifiedAt == null) || (current.verifiedAt == null && last.verifiedAt != null)) {
        diff.verifiedAt = current.verifiedAt;
      } else if (last.verifiedAt.valueOf() !== current.verifiedAt.valueOf()) {
        diff.verifiedAt = current.verifiedAt;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-email_verification_8000': function(clone, cloneEmbeddable, convertToDatabaseValue_id, processDateProperty, toArray, EntityIdentifier) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = convertToDatabaseValue_id(entity.id);
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.user !== 'undefined') {
        if (entity.user === null) {
          ret.user = null;
        } else if (entity.user?.__helper.__identifier && !entity.user.__helper.hasPrimaryKey()) {
          ret.user = entity.user?.__helper.__identifier;
        } else if (typeof entity.user !== 'undefined') {
          ret.user = toArray(entity.user.__helper.getPrimaryKey(true));
        }
      }

      if (typeof entity.token !== 'undefined') {
        ret.token = entity.token;
      }

      if (typeof entity.expiresAt !== 'undefined') {
        ret.expiresAt = clone(processDateProperty(entity.expiresAt));
      }

      if (typeof entity.verified !== 'undefined') {
        ret.verified = entity.verified;
      }

      if (typeof entity.verifiedAt !== 'undefined') {
        ret.verifiedAt = clone(processDateProperty(entity.verifiedAt));
      }

      return ret;
    }
  },
  'resultMapper-email_verification_8000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity EmailVerificationEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.user_sub !== 'undefined') {
        ret.user = result.user_sub;
        mapped.user_sub = true;
      }
      if (typeof result.token !== 'undefined') {
        ret.token = result.token;
        mapped.token = true;
      }
      if (typeof result.expires_at !== 'undefined') {
        if (result.expires_at == null || result.expires_at instanceof Date) {
          ret.expiresAt = result.expires_at;
        } else if (typeof result.expires_at === 'bigint') {
          ret.expiresAt = parseDate(Number(result.expires_at));
        } else if (typeof result.expires_at === 'number' || result.expires_at.includes('+') || result.expires_at.lastIndexOf('-') > 10 || result.expires_at.endsWith('Z')) {
          ret.expiresAt = parseDate(result.expires_at);
        } else {
          ret.expiresAt = parseDate(result.expires_at + 'Z');
        }
        mapped.expires_at = true;
      }
      if (typeof result.verified !== 'undefined') {
        ret.verified = result.verified == null ? result.verified : !!result.verified;
        mapped.verified = true;
      }
      if (typeof result.verified_at !== 'undefined') {
        if (result.verified_at == null || result.verified_at instanceof Date) {
          ret.verifiedAt = result.verified_at;
        } else if (typeof result.verified_at === 'bigint') {
          ret.verifiedAt = parseDate(Number(result.verified_at));
        } else if (typeof result.verified_at === 'number' || result.verified_at.includes('+') || result.verified_at.lastIndexOf('-') > 10 || result.verified_at.endsWith('Z')) {
          ret.verifiedAt = parseDate(result.verified_at);
        } else {
          ret.verifiedAt = parseDate(result.verified_at + 'Z');
        }
        mapped.verified_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-email_verification_8000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity EmailVerificationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'hydrator-email_verification_8000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError, convertToJSValue_id, convertToDatabaseValue_id) {
    // compiled hydrator for entity EmailVerificationEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        if (convertCustomTypes) {
          const value = convertToJSValue_id(data.id);
          entity.id = value;
        } else {
          entity.id = data.id;
        }
      }
    }
  },
  'pkGetter-email_verification_8000': function(isEntityOrRef) {
    // compiled pk getter for entity EmailVerificationEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-email_verification_8000': function(isEntityOrRef, convertToDatabaseValue_id) {
    // compiled pk getter (with converted custom types) for entity EmailVerificationEntity
    return function(entity) {
      return convertToDatabaseValue_id(entity.id);
    }
  },
  'pkSerializer-email_verification_8000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash, convertToDatabaseValue_id) {
    // compiled pk serializer for entity EmailVerificationEntity
    return function(entity) {
      const val_13 = convertToDatabaseValue_id(entity.id);
      return getPrimaryKeyHash(val_13);
    }
  },
  'hydrator-bootstrap_state_2000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BootstrapStateEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.value === null) {
        entity.value = null;
      } else if (typeof data.value !== 'undefined') {
        entity.value = data.value;
      }
    }
  },
  'hydrator-bootstrap_state_2000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BootstrapStateEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.value === null) {
        entity.value = null;
      } else if (typeof data.value !== 'undefined') {
        entity.value = data.value;
      }
    }
  },
  'comparator-bootstrap_state_2000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity BootstrapStateEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.value === null && last.value === undefined) {
        diff.value = current.value;
      } else if (current.value == null && last.value == null) {

      } else if ((current.value != null && last.value == null) || (current.value == null && last.value != null)) {
        diff.value = current.value;
      } else if (last.value !== current.value) {
        diff.value = current.value;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-bootstrap_state_2000': function(clone, cloneEmbeddable, processDateProperty) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = entity.id;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.value !== 'undefined') {
        ret.value = entity.value;
      }

      return ret;
    }
  },
  'resultMapper-bootstrap_state_2000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity BootstrapStateEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.value !== 'undefined') {
        ret.value = result.value;
        mapped.value = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-bootstrap_state_2000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BootstrapStateEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'hydrator-bootstrap_state_2000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BootstrapStateEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'pkGetter-bootstrap_state_2000': function(isEntityOrRef) {
    // compiled pk getter for entity BootstrapStateEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-bootstrap_state_2000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity BootstrapStateEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkSerializer-bootstrap_state_2000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity BootstrapStateEntity
    return function(entity) {
      return '' + entity.id;
    }
  },
  'hydrator-background_jobs_1000-full-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BackgroundJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.jobId === null) {
        entity.jobId = null;
      } else if (typeof data.jobId !== 'undefined') {
        entity.jobId = data.jobId;
      }
      if (data.payload === null) {
        entity.payload = null;
      } else if (typeof data.payload !== 'undefined') {
        entity.payload = data.payload;
      }
      if (data.status === null) {
        entity.status = null;
      } else if (typeof data.status !== 'undefined') {
        entity.status = data.status;
      }
      if (data.availableAt === null) {
        entity.availableAt = null;
      } else if (typeof data.availableAt !== 'undefined') {
        if (data.availableAt instanceof Date) {
          entity.availableAt = data.availableAt;
        } else if (typeof data.availableAt === 'number' || data.availableAt.includes('+') || data.availableAt.lastIndexOf('-') > 10 || data.availableAt.endsWith('Z')) {
          entity.availableAt = new Date(data.availableAt);
        } else {
          entity.availableAt = new Date(data.availableAt + 'Z');
        }
      }
      if (data.lockedBy === null) {
        entity.lockedBy = null;
      } else if (typeof data.lockedBy !== 'undefined') {
        entity.lockedBy = data.lockedBy;
      }
      if (data.lockedUntil === null) {
        entity.lockedUntil = null;
      } else if (typeof data.lockedUntil !== 'undefined') {
        if (data.lockedUntil instanceof Date) {
          entity.lockedUntil = data.lockedUntil;
        } else if (typeof data.lockedUntil === 'number' || data.lockedUntil.includes('+') || data.lockedUntil.lastIndexOf('-') > 10 || data.lockedUntil.endsWith('Z')) {
          entity.lockedUntil = new Date(data.lockedUntil);
        } else {
          entity.lockedUntil = new Date(data.lockedUntil + 'Z');
        }
      }
      if (data.attemptCount === null) {
        entity.attemptCount = null;
      } else if (typeof data.attemptCount !== 'undefined') {
        entity.attemptCount = data.attemptCount;
      }
      if (data.maxAttempts === null) {
        entity.maxAttempts = null;
      } else if (typeof data.maxAttempts !== 'undefined') {
        entity.maxAttempts = data.maxAttempts;
      }
      if (data.lastError === null) {
        entity.lastError = null;
      } else if (typeof data.lastError !== 'undefined') {
        entity.lastError = data.lastError;
      }
      if (data.completedAt === null) {
        entity.completedAt = null;
      } else if (typeof data.completedAt !== 'undefined') {
        if (data.completedAt instanceof Date) {
          entity.completedAt = data.completedAt;
        } else if (typeof data.completedAt === 'number' || data.completedAt.includes('+') || data.completedAt.lastIndexOf('-') > 10 || data.completedAt.endsWith('Z')) {
          entity.completedAt = new Date(data.completedAt);
        } else {
          entity.completedAt = new Date(data.completedAt + 'Z');
        }
      }
    }
  },
  'hydrator-background_jobs_1000-full-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BackgroundJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
      if (data.created_at === null) {
        entity.created_at = null;
      } else if (typeof data.created_at !== 'undefined') {
        if (data.created_at instanceof Date) {
          entity.created_at = data.created_at;
        } else if (typeof data.created_at === 'number' || data.created_at.includes('+') || data.created_at.lastIndexOf('-') > 10 || data.created_at.endsWith('Z')) {
          entity.created_at = new Date(data.created_at);
        } else {
          entity.created_at = new Date(data.created_at + 'Z');
        }
      }
      if (data.updated_at === null) {
        entity.updated_at = null;
      } else if (typeof data.updated_at !== 'undefined') {
        if (data.updated_at instanceof Date) {
          entity.updated_at = data.updated_at;
        } else if (typeof data.updated_at === 'number' || data.updated_at.includes('+') || data.updated_at.lastIndexOf('-') > 10 || data.updated_at.endsWith('Z')) {
          entity.updated_at = new Date(data.updated_at);
        } else {
          entity.updated_at = new Date(data.updated_at + 'Z');
        }
      }
      if (data.jobId === null) {
        entity.jobId = null;
      } else if (typeof data.jobId !== 'undefined') {
        entity.jobId = data.jobId;
      }
      if (data.payload === null) {
        entity.payload = null;
      } else if (typeof data.payload !== 'undefined') {
        entity.payload = data.payload;
      }
      if (data.status === null) {
        entity.status = null;
      } else if (typeof data.status !== 'undefined') {
        entity.status = data.status;
      }
      if (data.availableAt === null) {
        entity.availableAt = null;
      } else if (typeof data.availableAt !== 'undefined') {
        if (data.availableAt instanceof Date) {
          entity.availableAt = data.availableAt;
        } else if (typeof data.availableAt === 'number' || data.availableAt.includes('+') || data.availableAt.lastIndexOf('-') > 10 || data.availableAt.endsWith('Z')) {
          entity.availableAt = new Date(data.availableAt);
        } else {
          entity.availableAt = new Date(data.availableAt + 'Z');
        }
      }
      if (data.lockedBy === null) {
        entity.lockedBy = null;
      } else if (typeof data.lockedBy !== 'undefined') {
        entity.lockedBy = data.lockedBy;
      }
      if (data.lockedUntil === null) {
        entity.lockedUntil = null;
      } else if (typeof data.lockedUntil !== 'undefined') {
        if (data.lockedUntil instanceof Date) {
          entity.lockedUntil = data.lockedUntil;
        } else if (typeof data.lockedUntil === 'number' || data.lockedUntil.includes('+') || data.lockedUntil.lastIndexOf('-') > 10 || data.lockedUntil.endsWith('Z')) {
          entity.lockedUntil = new Date(data.lockedUntil);
        } else {
          entity.lockedUntil = new Date(data.lockedUntil + 'Z');
        }
      }
      if (data.attemptCount === null) {
        entity.attemptCount = null;
      } else if (typeof data.attemptCount !== 'undefined') {
        entity.attemptCount = data.attemptCount;
      }
      if (data.maxAttempts === null) {
        entity.maxAttempts = null;
      } else if (typeof data.maxAttempts !== 'undefined') {
        entity.maxAttempts = data.maxAttempts;
      }
      if (data.lastError === null) {
        entity.lastError = null;
      } else if (typeof data.lastError !== 'undefined') {
        entity.lastError = data.lastError;
      }
      if (data.completedAt === null) {
        entity.completedAt = null;
      } else if (typeof data.completedAt !== 'undefined') {
        if (data.completedAt instanceof Date) {
          entity.completedAt = data.completedAt;
        } else if (typeof data.completedAt === 'number' || data.completedAt.includes('+') || data.completedAt.lastIndexOf('-') > 10 || data.completedAt.endsWith('Z')) {
          entity.completedAt = new Date(data.completedAt);
        } else {
          entity.completedAt = new Date(data.completedAt + 'Z');
        }
      }
    }
  },
  'comparator-background_jobs_1000': function(compareArrays, compareBooleans, compareBuffers, compareObjects, equals) {
    // compiled comparator for entity BackgroundJobEntity
    return function(last, current, options) {
      const diff = {};
      if (current.id === null && last.id === undefined) {
        diff.id = current.id;
      } else if (current.id == null && last.id == null) {

      } else if ((current.id != null && last.id == null) || (current.id == null && last.id != null)) {
        diff.id = current.id;
      } else if (last.id !== current.id) {
        diff.id = current.id;
      }

      if (current.created_at === null && last.created_at === undefined) {
        diff.created_at = current.created_at;
      } else if (current.created_at == null && last.created_at == null) {

      } else if ((current.created_at != null && last.created_at == null) || (current.created_at == null && last.created_at != null)) {
        diff.created_at = current.created_at;
      } else if (last.created_at.valueOf() !== current.created_at.valueOf()) {
        diff.created_at = current.created_at;
      }

      if (current.updated_at === null && last.updated_at === undefined) {
        diff.updated_at = current.updated_at;
      } else if (current.updated_at == null && last.updated_at == null) {

      } else if ((current.updated_at != null && last.updated_at == null) || (current.updated_at == null && last.updated_at != null)) {
        diff.updated_at = current.updated_at;
      } else if (last.updated_at.valueOf() !== current.updated_at.valueOf()) {
        diff.updated_at = current.updated_at;
      }

      if (current.jobId === null && last.jobId === undefined) {
        diff.jobId = current.jobId;
      } else if (current.jobId == null && last.jobId == null) {

      } else if ((current.jobId != null && last.jobId == null) || (current.jobId == null && last.jobId != null)) {
        diff.jobId = current.jobId;
      } else if (last.jobId !== current.jobId) {
        diff.jobId = current.jobId;
      }

      if (current.payload === null && last.payload === undefined) {
        diff.payload = current.payload;
      } else if (current.payload == null && last.payload == null) {

      } else if ((current.payload != null && last.payload == null) || (current.payload == null && last.payload != null)) {
        diff.payload = current.payload;
      } else if (!equals(last.payload, current.payload)) {
        diff.payload = current.payload;
      }

      if (current.status === null && last.status === undefined) {
        diff.status = current.status;
      } else if (current.status == null && last.status == null) {

      } else if ((current.status != null && last.status == null) || (current.status == null && last.status != null)) {
        diff.status = current.status;
      } else if (last.status !== current.status) {
        diff.status = current.status;
      }

      if (current.availableAt === null && last.availableAt === undefined) {
        diff.availableAt = current.availableAt;
      } else if (current.availableAt == null && last.availableAt == null) {

      } else if ((current.availableAt != null && last.availableAt == null) || (current.availableAt == null && last.availableAt != null)) {
        diff.availableAt = current.availableAt;
      } else if (last.availableAt.valueOf() !== current.availableAt.valueOf()) {
        diff.availableAt = current.availableAt;
      }

      if (current.lockedBy === null && last.lockedBy === undefined) {
        diff.lockedBy = current.lockedBy;
      } else if (current.lockedBy == null && last.lockedBy == null) {

      } else if ((current.lockedBy != null && last.lockedBy == null) || (current.lockedBy == null && last.lockedBy != null)) {
        diff.lockedBy = current.lockedBy;
      } else if (last.lockedBy !== current.lockedBy) {
        diff.lockedBy = current.lockedBy;
      }

      if (current.lockedUntil === null && last.lockedUntil === undefined) {
        diff.lockedUntil = current.lockedUntil;
      } else if (current.lockedUntil == null && last.lockedUntil == null) {

      } else if ((current.lockedUntil != null && last.lockedUntil == null) || (current.lockedUntil == null && last.lockedUntil != null)) {
        diff.lockedUntil = current.lockedUntil;
      } else if (last.lockedUntil.valueOf() !== current.lockedUntil.valueOf()) {
        diff.lockedUntil = current.lockedUntil;
      }

      if (current.attemptCount === null && last.attemptCount === undefined) {
        diff.attemptCount = current.attemptCount;
      } else if (current.attemptCount == null && last.attemptCount == null) {

      } else if ((current.attemptCount != null && last.attemptCount == null) || (current.attemptCount == null && last.attemptCount != null)) {
        diff.attemptCount = current.attemptCount;
      } else if (!equals(last.attemptCount, current.attemptCount)) {
        diff.attemptCount = current.attemptCount;
      }

      if (current.maxAttempts === null && last.maxAttempts === undefined) {
        diff.maxAttempts = current.maxAttempts;
      } else if (current.maxAttempts == null && last.maxAttempts == null) {

      } else if ((current.maxAttempts != null && last.maxAttempts == null) || (current.maxAttempts == null && last.maxAttempts != null)) {
        diff.maxAttempts = current.maxAttempts;
      } else if (!equals(last.maxAttempts, current.maxAttempts)) {
        diff.maxAttempts = current.maxAttempts;
      }

      if (current.lastError === null && last.lastError === undefined) {
        diff.lastError = current.lastError;
      } else if (current.lastError == null && last.lastError == null) {

      } else if ((current.lastError != null && last.lastError == null) || (current.lastError == null && last.lastError != null)) {
        diff.lastError = current.lastError;
      } else if (!equals(last.lastError, current.lastError)) {
        diff.lastError = current.lastError;
      }

      if (current.completedAt === null && last.completedAt === undefined) {
        diff.completedAt = current.completedAt;
      } else if (current.completedAt == null && last.completedAt == null) {

      } else if ((current.completedAt != null && last.completedAt == null) || (current.completedAt == null && last.completedAt != null)) {
        diff.completedAt = current.completedAt;
      } else if (last.completedAt.valueOf() !== current.completedAt.valueOf()) {
        diff.completedAt = current.completedAt;
      }

    if (options?.includeInverseSides) {
    }
      return diff;
    }
  },
  'snapshotGenerator-background_jobs_1000': function(clone, cloneEmbeddable, processDateProperty) {
    return function(entity) {
      const ret = {};
      if (typeof entity.id !== 'undefined') {
        ret.id = entity.id;
      }

      if (typeof entity.created_at !== 'undefined') {
        ret.created_at = clone(processDateProperty(entity.created_at));
      }

      if (typeof entity.updated_at !== 'undefined') {
        ret.updated_at = clone(processDateProperty(entity.updated_at));
      }

      if (typeof entity.jobId !== 'undefined') {
        ret.jobId = entity.jobId;
      }

      if (typeof entity.payload !== 'undefined') {
        ret.payload = clone(entity.payload);
      }

      if (typeof entity.status !== 'undefined') {
        ret.status = entity.status;
      }

      if (typeof entity.availableAt !== 'undefined') {
        ret.availableAt = clone(processDateProperty(entity.availableAt));
      }

      if (typeof entity.lockedBy !== 'undefined') {
        ret.lockedBy = entity.lockedBy;
      }

      if (typeof entity.lockedUntil !== 'undefined') {
        ret.lockedUntil = clone(processDateProperty(entity.lockedUntil));
      }

      if (typeof entity.attemptCount !== 'undefined') {
        ret.attemptCount = clone(entity.attemptCount);
      }

      if (typeof entity.maxAttempts !== 'undefined') {
        ret.maxAttempts = clone(entity.maxAttempts);
      }

      if (typeof entity.lastError !== 'undefined') {
        ret.lastError = clone(entity.lastError);
      }

      if (typeof entity.completedAt !== 'undefined') {
        ret.completedAt = clone(processDateProperty(entity.completedAt));
      }

      return ret;
    }
  },
  'resultMapper-background_jobs_1000': function(PolymorphicRef, parseDate) {
    // compiled mapper for entity BackgroundJobEntity
    return function(result) {
      const ret = {};
      const mapped = {};
      if (typeof result.id !== 'undefined') {
        ret.id = result.id;
        mapped.id = true;
      }
      if (typeof result.created_at !== 'undefined') {
        if (result.created_at == null || result.created_at instanceof Date) {
          ret.created_at = result.created_at;
        } else if (typeof result.created_at === 'bigint') {
          ret.created_at = parseDate(Number(result.created_at));
        } else if (typeof result.created_at === 'number' || result.created_at.includes('+') || result.created_at.lastIndexOf('-') > 10 || result.created_at.endsWith('Z')) {
          ret.created_at = parseDate(result.created_at);
        } else {
          ret.created_at = parseDate(result.created_at + 'Z');
        }
        mapped.created_at = true;
      }
      if (typeof result.updated_at !== 'undefined') {
        if (result.updated_at == null || result.updated_at instanceof Date) {
          ret.updated_at = result.updated_at;
        } else if (typeof result.updated_at === 'bigint') {
          ret.updated_at = parseDate(Number(result.updated_at));
        } else if (typeof result.updated_at === 'number' || result.updated_at.includes('+') || result.updated_at.lastIndexOf('-') > 10 || result.updated_at.endsWith('Z')) {
          ret.updated_at = parseDate(result.updated_at);
        } else {
          ret.updated_at = parseDate(result.updated_at + 'Z');
        }
        mapped.updated_at = true;
      }
      if (typeof result.job_id !== 'undefined') {
        ret.jobId = result.job_id;
        mapped.job_id = true;
      }
      if (typeof result.payload !== 'undefined') {
        ret.payload = result.payload;
        mapped.payload = true;
      }
      if (typeof result.status !== 'undefined') {
        ret.status = result.status;
        mapped.status = true;
      }
      if (typeof result.available_at !== 'undefined') {
        if (result.available_at == null || result.available_at instanceof Date) {
          ret.availableAt = result.available_at;
        } else if (typeof result.available_at === 'bigint') {
          ret.availableAt = parseDate(Number(result.available_at));
        } else if (typeof result.available_at === 'number' || result.available_at.includes('+') || result.available_at.lastIndexOf('-') > 10 || result.available_at.endsWith('Z')) {
          ret.availableAt = parseDate(result.available_at);
        } else {
          ret.availableAt = parseDate(result.available_at + 'Z');
        }
        mapped.available_at = true;
      }
      if (typeof result.locked_by !== 'undefined') {
        ret.lockedBy = result.locked_by;
        mapped.locked_by = true;
      }
      if (typeof result.locked_until !== 'undefined') {
        if (result.locked_until == null || result.locked_until instanceof Date) {
          ret.lockedUntil = result.locked_until;
        } else if (typeof result.locked_until === 'bigint') {
          ret.lockedUntil = parseDate(Number(result.locked_until));
        } else if (typeof result.locked_until === 'number' || result.locked_until.includes('+') || result.locked_until.lastIndexOf('-') > 10 || result.locked_until.endsWith('Z')) {
          ret.lockedUntil = parseDate(result.locked_until);
        } else {
          ret.lockedUntil = parseDate(result.locked_until + 'Z');
        }
        mapped.locked_until = true;
      }
      if (typeof result.attempt_count !== 'undefined') {
        ret.attemptCount = result.attempt_count;
        mapped.attempt_count = true;
      }
      if (typeof result.max_attempts !== 'undefined') {
        ret.maxAttempts = result.max_attempts;
        mapped.max_attempts = true;
      }
      if (typeof result.last_error !== 'undefined') {
        ret.lastError = result.last_error;
        mapped.last_error = true;
      }
      if (typeof result.completed_at !== 'undefined') {
        if (result.completed_at == null || result.completed_at instanceof Date) {
          ret.completedAt = result.completed_at;
        } else if (typeof result.completed_at === 'bigint') {
          ret.completedAt = parseDate(Number(result.completed_at));
        } else if (typeof result.completed_at === 'number' || result.completed_at.includes('+') || result.completed_at.lastIndexOf('-') > 10 || result.completed_at.endsWith('Z')) {
          ret.completedAt = parseDate(result.completed_at);
        } else {
          ret.completedAt = parseDate(result.completed_at + 'Z');
        }
        mapped.completed_at = true;
      }
      for (let k in result) { if (Object.hasOwn(result, k) && !mapped[k] && ret[k] === undefined) ret[k] = result[k]; }
      return ret;
    }
  },
  'hydrator-background_jobs_1000-reference-false': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BackgroundJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'hydrator-background_jobs_1000-reference-true': function(isPrimaryKey, isEntity, isScalarReference, Collection, Reference, PolymorphicRef, ValidationError) {
    // compiled hydrator for entity BackgroundJobEntity ( normalized)
    return function(entity, data, factory, newEntity, convertCustomTypes, schema, parentSchema, normalizeAccessors) {
      if (data.id === null) {
        entity.id = null;
      } else if (typeof data.id !== 'undefined') {
        entity.id = data.id;
      }
    }
  },
  'pkGetter-background_jobs_1000': function(isEntityOrRef) {
    // compiled pk getter for entity BackgroundJobEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkGetterConverted-background_jobs_1000': function(isEntityOrRef) {
    // compiled pk getter (with converted custom types) for entity BackgroundJobEntity
    return function(entity) {
      return entity.id;
    }
  },
  'pkSerializer-background_jobs_1000': function(isEntityOrRef, getCompositeKeyValue, getPrimaryKeyHash) {
    // compiled pk serializer for entity BackgroundJobEntity
    return function(entity) {
      return '' + entity.id;
    }
  }
};
