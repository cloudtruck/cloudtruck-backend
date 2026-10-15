import asyncHandler from '../utils/asyncHandler.js';
import ApiResponse from '../utils/ApiResponse.js';
import AgentContactService from '../services/agentContact.service.js';

// @route   GET /api/v1/agent-contacts
// @access  Admin
export const listAgentContacts = asyncHandler(async (req, res) => {
  const contacts = await AgentContactService.list();
  res.json(new ApiResponse(200, contacts, 'Agent contacts fetched successfully'));
});

// @route   POST /api/v1/agent-contacts
// @access  Admin
export const createAgentContact = asyncHandler(async (req, res) => {
  const contact = await AgentContactService.create(req.body, req.user?._id);
  res.status(201).json(new ApiResponse(201, contact, 'Agent contact created successfully'));
});

// @route   PATCH /api/v1/agent-contacts/:id
// @access  Admin
export const updateAgentContact = asyncHandler(async (req, res) => {
  const contact = await AgentContactService.update(req.params.id, req.body, req.user?._id);
  res.json(new ApiResponse(200, contact, 'Agent contact updated successfully'));
});

// @route   DELETE /api/v1/agent-contacts/:id
// @access  Admin
export const deleteAgentContact = asyncHandler(async (req, res) => {
  await AgentContactService.remove(req.params.id);
  res.json(new ApiResponse(200, null, 'Agent contact deleted successfully'));
});

// @route   GET /api/v1/agent-contacts/lookup?state=
// @access  Any authenticated user (customer app)
export const lookupAgentContact = asyncHandler(async (req, res) => {
  const result = await AgentContactService.lookup(req.query.state);
  res.json(new ApiResponse(200, result, 'Agent contact fetched successfully'));
});
