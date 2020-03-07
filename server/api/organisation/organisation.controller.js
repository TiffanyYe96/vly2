const Organisation = require('./organisation')
const { Role } = require('../../services/authorize/role')

/**
 * Get all orgs
 * @param req
 * @param res
 * @returns void
 */

const getOrganisations = async (req, res) => {
  let query = {}
  let sort = 'name'
  let select = null
  try {
    query = req.query.q ? JSON.parse(req.query.q) : query
    sort = req.query.s ? JSON.parse(req.query.s) : sort
    select = req.query.p ? req.query.p : null
  } catch (e) {
    // if there is something wrong with the query return a Bad Query
    return res.status(400).send(e)
  }
  try {
    const got = await Organisation.find(query, select).sort(sort).exec()
    res.json(got)
  } catch (e) {
    // If we can't find a match return 404
    res.status(404).send(e)
  }
}

// Update
const putOrganisation = async (req, res) => {
  const isAdmin = req.session.me.role.includes(Role.ADMIN)

  // The current user must be; an ADMIN, or an ORG_ADMIN of the requested organisation
  if (!isAdmin && !req.session.me.orgAdminFor.includes(req.params._id)) {
    return res.status(403).send('Must be admin or org admin')
  }

  // Category field can only be set by ADMIN
  if (!isAdmin) {
    delete req.body.category
  }

  await Organisation.findByIdAndUpdate(req.params._id, { $set: req.body })
  res.json(await Organisation.findById(req.params._id).exec())
}

// Create
const postOrganisation = async (req, res) => {
  if (!req.session.me.role.includes(Role.ADMIN)) {
    return res.status(403).send('Must be admin to create an organisation')
  }

  const org = await new Organisation(req.body).save()
  return res.json(org)
}

// Delete
const deleteOrganisation = async (req, res) => {
  if (!req.session.me.role.includes(Role.ADMIN)) {
    return res.status(403).send('Must be admin to delete an organisation')
  }

  if (!req.params._id) {
    return res.status(400).end()
  }

  await Organisation.deleteOne({ _id: req.params._id })
  return res.status(204).end()
}

module.exports = {
  getOrganisations,
  putOrganisation,
  postOrganisation,
  deleteOrganisation
}
