import AgentContact from '../models/agentContact.model.js';
import OrganizationSettings from '../models/organizationSettings.model.js';
import ApiError from '../utils/ApiError.js';

const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const rethrowDuplicate = (err) => {
  if (err?.code === 11000) throw new ApiError(409, 'An agent contact already exists for this state');
  throw err;
};

class AgentContactService {
  static list() {
    return AgentContact.find().sort({ state: 1 });
  }

  static async create(data, userId) {
    try {
      return await AgentContact.create({ ...data, updatedBy: userId });
    } catch (err) {
      return rethrowDuplicate(err);
    }
  }

  static async update(id, data, userId) {
    try {
      const doc = await AgentContact.findByIdAndUpdate(
        id,
        { ...data, updatedBy: userId },
        { new: true, runValidators: true }
      );
      if (!doc) throw new ApiError(404, 'Agent contact not found');
      return doc;
    } catch (err) {
      return rethrowDuplicate(err);
    }
  }

  static async remove(id) {
    const doc = await AgentContact.findByIdAndDelete(id);
    if (!doc) throw new ApiError(404, 'Agent contact not found');
  }

  // Active contact for the state, else the organization's main phone, else null
  static async lookup(state) {
    if (state && typeof state === 'string' && state.trim()) {
      const match = await AgentContact.findOne({ state: state.trim(), isActive: true }).collation(CASE_INSENSITIVE);
      if (match) return { state: match.state, phone: match.phone, isFallback: false };
    }

    const settings = await OrganizationSettings.findOne();
    return { state: state || null, phone: settings?.contactDetails?.phone || null, isFallback: true };
  }
}

export default AgentContactService;
