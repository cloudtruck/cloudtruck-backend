// models/document.model.js
import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Document model (compatible and flexible)
 *
 * Notes:
 * - ownerRef.kind is intentionally a free-form string to avoid conflicts
 *   with code that uses different naming conventions (e.g., 'booking' vs 'Booking').
 * - We intentionally do not use refPath here to avoid runtime errors when kinds
 *   do not match registered model names. Populate manually when needed.
 * - The `content` field is available for storing small snapshots (e.g., audit snapshots).
 *   Keep snapshots small; use the AuditLog pre-save logic to offload large snapshots elsewhere.
 */

const documentSchema = new Schema(
  {
    ownerRef: {
      // free-form kind: e.g. 'User', 'Driver', 'booking', 'system', etc.
      kind: { type: String, index: true, default: null },
      // item is a plain ObjectId; populate manually if you know the model
      item: { type: Schema.Types.ObjectId, index: true, default: null }
    },

    // semantic type of the document, e.g., 'license', 'gst', 'profile_photo', 'audit-snapshot'
    type: { type: String, required: false, index: true },

    // provider metadata (default cloudinary)
    provider: { type: String, default: 'cloudinary', index: true },
    providerId: { type: String, index: true }, // public_id, key, etc.
    url: { type: String },                      // canonical public URL (secure_url)
    format: { type: String },
    resourceType: { type: String },             // 'image', 'raw', 'video'
    bytes: { type: Number },
    width: { type: Number },
    height: { type: Number },
    folder: { type: String },
    version: { type: Number },
    checksum: { type: String },                 // optional integrity hash

    // free-form metadata
    meta: { type: Schema.Types.Mixed, default: {} },

    // optional inline content for small snapshots (audit). Marked select:false by default.
    content: { type: Schema.Types.Mixed, select: false },

    // who created/uploaded this Document
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
    uploadedAt: { type: Date, default: Date.now },

    // status for processing pipelines (OCR, virus-scan, verification)
    status: {
      type: String,
      enum: ['uploaded', 'processing', 'verified', 'rejected', 'nulled'],
      default: 'uploaded',
      index: true
    },
    
    // Soft Delete
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: Date,
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

/* Indexes */
// Query by ownerRef (kind + item)
documentSchema.index({ 'ownerRef.kind': 1, 'ownerRef.item': 1 });
// Provider / providerId lookups for deletes and updates
documentSchema.index({ provider: 1, providerId: 1 });
// TTL or retention is not added here; if needed add a retention policy in your app logic

/* Statics */

/**
 * createSnapshot
 * Convenience method used by audit to store small snapshots.
 * Keeps field names clear and consistent.
 *
 * Accepts:
 *  - ownerRef: { kind, item }
 *  - snapshot: arbitrary object to store in `content`
 *  - meta: optional metadata
 *
 * Returns created Document doc
 */
documentSchema.statics.createSnapshot = async function ({ ownerRef = {}, snapshot = {}, meta = {}, uploadedBy = null } = {}) {
  // keep snapshot small — this is a convenience method only
  const payload = {
    ownerRef: {
      kind: ownerRef.kind || null,
      item: ownerRef.item || null
    },
    type: 'audit-snapshot',
    provider: 'inline',
    content: snapshot,
    meta,
    uploadedBy: uploadedBy || null,
    status: 'verified'
  };

  return this.create(payload);
};

/**
 * safeDeleteByProvider
 * Delete reference in DB and optionally call provider SDK outside this method.
 * This method only removes DB record and returns the provider info so caller can delete from
 * cloudinary/S3 etc. This separation keeps provider SDK calls out of model logic.
 */
documentSchema.statics.safeDeleteById = async function (id) {
  const doc = await this.findById(id).lean();
  if (!doc) return null;
  await this.deleteOne({ _id: id });
  return { provider: doc.provider, providerId: doc.providerId, url: doc.url };
};

/* Methods */

/**
 * toPublicJSON
 * Return a safe public view of the document (strip internal content)
 */
documentSchema.methods.toPublicJSON = function () {
  return {
    _id: this._id,
    ownerRef: this.ownerRef,
    type: this.type,
    provider: this.provider,
    providerId: this.providerId,
    url: this.url,
    format: this.format,
    resourceType: this.resourceType,
    bytes: this.bytes,
    width: this.width,
    height: this.height,
    folder: this.folder,
    version: this.version,
    checksum: this.checksum,
    meta: this.meta,
    uploadedBy: this.uploadedBy,
    uploadedAt: this.uploadedAt,
    status: this.status,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

/* Static Methods */

// Find active documents
documentSchema.statics.findActive = function() {
  return this.find({ isDeleted: false });
};

/* Instance Methods */

// Soft delete
documentSchema.methods.softDelete = function(userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

export default mongoose.model('Document', documentSchema);
