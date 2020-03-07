const Interest = require('./interest')
const { Action } = require('../../services/abilities/ability.constants')
const { getInterestDetail, getMyOpInterestDetail } = require('./interest.lib')
const { TOPIC_INTEREST__UPDATE, TOPIC_INTEREST__MESSAGE, TOPIC_INTEREST__DELETE } = require('../../services/pubsub/topic.constants')
const PubSub = require('pubsub-js')
const { Role } = require('../../services/authorize/role')
const { InterestStatus } = require('./interest.constants')

/**
  api/interests -> list all interests
  api/interests?op='opid' -> lists all interests associated with opid.
  api/interests?op='opid'&me='personid' -> lists all interests (hopefully only 0 or 1) associated with opid and personid.
  api/interests?me='personid' -> list all the ops i'm interested in and populate the op out.
 */
const listInterests = async (req, res) => {
  const sort = 'dateAdded' // todo sort by date.

  try {
    if (req.query.op && req.query.me) {
      // this is a request for a single interest for one person and one op
      // populate out ready for the opdetailspage display
      try {
        const interest = await getMyOpInterestDetail(req.query.op, req.query.me)
        return res.json([interest])
      } catch (e) {
        // its not an error to have no interests yet.
        return res.json([])
      }
    }
    const find = {}
    const populateList = []

    if (req.query.op) {
      find.opportunity = req.query.op
      populateList.push({ path: 'person', select: 'nickname name imgUrl' })
    }

    if (req.query.me) {
      find.person = req.query.me
      populateList.push({ path: 'opportunity' })
    }

    const query = Interest.find(find)

    for (const populate of populateList) {
      query.populate(populate)
    }

    const interests = (await query
      .accessibleBy(req.ability, Action.LIST)
      .sort(sort)
      .exec())
      .filter(opportunity => opportunity.person !== null)

    res.json(interests)
  } catch (err) {
    // console.error(err)
    res.status(404).send(err)
  }
}

const getInterest = async (req, res, next) => {
  try {
    const interest = await Interest
      .accessibleBy(req.ability, Action.READ)
      .findOne(req.params)

    if (interest === null) {
      return res.status(404).send()
    }

    res.json(interest)
  } catch (e) {
    res.status(500).send()
  }
}

const createInterest = async (req, res) => {
  const interestData = req.body

  if (!interestData.person) {
    interestData.person = (req.session.me && req.session.me._id) ? req.session.me._id : undefined
  }

  const interest = new Interest(interestData)

  if (!req.ability.can(Action.CREATE, interest)) {
    return res.sendStatus(403)
  }

  try {
    await interest.save()

    const interestDetail = await getInterestDetail(interest._id)
    interestDetail.type = 'accept'
    PubSub.publish(TOPIC_INTEREST__UPDATE, interestDetail)

    res.json(interestDetail)
  } catch (err) {
  // console.error(err)
    res.status(422).send(err)
  }
}

const updateInterest = async (req, res) => {
  try {
    const existingInterest = await Interest.findOne(req.params)
      .accessibleBy(req.ability, Action.READ)

    if (existingInterest === null) {
      return res.sendStatus(404)
    }

    const interestUpdateData = req.body
    const person = req.session.me

    if (
      interestUpdateData.status &&
      person.role.includes(Role.VOLUNTEER_PROVIDER) &&
      existingInterest.person.toString() === req.session.me._id.toString()
    ) {
      if (!isValidTransition(existingInterest.status, interestUpdateData.status)) {
        return res.status(403).json({
          message: 'Invalid status transition'
        })
      }
    }

    if (interestUpdateData.status) {
      existingInterest.status = interestUpdateData.status
    }

    if (interestUpdateData.messages) {
      interestUpdateData.messages = Array.isArray(interestUpdateData.messages)
        ? interestUpdateData.messages : [interestUpdateData.messages]

      existingInterest.messages = existingInterest.messages.concat(interestUpdateData.messages)
    }

    if (!req.ability.can(Action.UPDATE, existingInterest)) {
      return res.status(403).json({
        message: 'Invalid update attempted'
      })
    }

    await existingInterest.save()

    const interestDetail = await getInterestDetail(req.params._id)
    interestDetail.type = interestUpdateData.type

    if (interestUpdateData.type === 'message') {
      PubSub.publish(TOPIC_INTEREST__MESSAGE, interestDetail)
    } else {
      PubSub.publish(TOPIC_INTEREST__UPDATE, interestDetail)
    }

    res.json(interestDetail)
  } catch (err) {
    // console.error(err)
    res.status(404).send(err)
  }
}

const isValidTransition = (originalStatus, newStatus) => {
  const validTransitionMap = {
    [InterestStatus.INVITED]: [
      InterestStatus.COMMITTED
    ],
    [InterestStatus.COMMITTED]: [
      InterestStatus.INTERESTED
    ]
  }

  return (
    validTransitionMap[originalStatus] &&
    validTransitionMap[originalStatus].includes(newStatus)
  )
}

const deleteInterest = async (req, res, next) => {
  try {
    const result = await Interest
      .accessibleBy(req.ability, Action.DELETE)
      .deleteOne(req.params)

    if (result.deletedCount === 0) {
      return res.sendStatus(404)
    }
    PubSub.publish(TOPIC_INTEREST__DELETE, req.params)

    return res.status(200).send(req.params)
  } catch (e) {
    console.error(e)
    return res.sendStatus(500)
  }
}

module.exports = {
  listInterests,
  getInterest,
  updateInterest,
  createInterest,
  deleteInterest
}
