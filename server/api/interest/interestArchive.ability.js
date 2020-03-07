const { Role } = require('../../services/authorize/role')
const { Action } = require('../../services/abilities/ability.constants')
const ArchivedOpportunity = require('../archivedOpportunity/archivedOpportunity')
const { InterestArchiveSchemaName } = require('./interest.constants')

const ruleBuilder = async (session) => {
  const anonRules = [{
    subject: InterestArchiveSchemaName,
    action: Action.LIST,
    inverted: true
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.CREATE,
    inverted: true
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.READ,
    inverted: true
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.UPDATE,
    inverted: true
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.DELETE,
    inverted: true
  }]

  const volunteerRules = []

  if (session.me && session.me._id) {
    volunteerRules.push({
      subject: InterestArchiveSchemaName,
      action: Action.LIST,
      conditions: { person: session.me._id }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.READ,
      conditions: { person: session.me._id }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.CREATE,
      inverted: true
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.UPDATE,
      inverted: true
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.DELETE,
      inverted: true
    })
  }

  const opportunityProviderRules = []
  if (session.me && session.me._id && session.me.role.includes(Role.OPPORTUNITY_PROVIDER)) {
    const myOpportunities = await ArchivedOpportunity.find({ requestor: session.me._id })
    const myOpportunityIds = myOpportunities.map(op => op._id.toString())
    opportunityProviderRules.push({
      subject: InterestArchiveSchemaName,
      action: Action.LIST,
      conditions: { opportunity: { $in: myOpportunityIds } }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.READ,
      conditions: { opportunity: { $in: myOpportunityIds } }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.CREATE,
      inverted: true
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.UPDATE,
      conditions: { opportunity: { $in: myOpportunityIds } }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.DELETE,
      inverted: true
    })
  }

  const orgAdminRules = []

  if (session.me && session.me._id && session.me.role.includes(Role.ORG_ADMIN)) {
    const myOpportunities = await ArchivedOpportunity.find({ offerOrg: { $in: session.me.orgAdminFor } })
    const myOpportunityIds = myOpportunities.map(op => op._id.toString())

    orgAdminRules.push({
      subject: InterestArchiveSchemaName,
      action: Action.LIST,
      conditions: { opportunity: { $in: myOpportunityIds } }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.READ,
      conditions: { opportunity: { $in: myOpportunityIds } }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.CREATE,
      inverted: true
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.UPDATE,
      conditions: { opportunity: { $in: myOpportunityIds } }
    }, {
      subject: InterestArchiveSchemaName,
      action: Action.DELETE,
      inverted: true
    })
  }

  const adminRules = [{
    subject: InterestArchiveSchemaName,
    action: Action.READ
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.LIST
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.UPDATE
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.DELETE,
    inverted: true
  }, {
    subject: InterestArchiveSchemaName,
    action: Action.CREATE,
    inverted: true
  }]
  return {
    [Role.ANON]: anonRules,
    [Role.VOLUNTEER_PROVIDER]: volunteerRules,
    // [Role.ACTIVITY_PROVIDER]: volunteerRules, // don't include roles that have no rules
    [Role.OPPORTUNITY_PROVIDER]: opportunityProviderRules,
    [Role.ORG_ADMIN]: orgAdminRules,
    [Role.ADMIN]: adminRules
  }
}

module.exports = ruleBuilder
