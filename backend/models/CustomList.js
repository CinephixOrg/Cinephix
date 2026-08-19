import mongoose from "mongoose";
const { Schema } = mongoose;

const listItemSchema = new Schema(
  {
    itemId: { type: Schema.Types.ObjectId, required: true },
    itemType: { type: String, enum: ["movie", "series"], required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customListSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 300, default: "" },
    isPublic: { type: Boolean, default: false },
    items: { type: [listItemSchema], default: [] },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    views: { type: Number, default: 0 },
    // Manual drag-reorder position among this owner's lists — higher shows
    // first. Not backfilled by a migration; /me lazily assigns real values
    // to any list still at the schema default the first time it's fetched.
    order: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

customListSchema.index({ owner: 1 });
customListSchema.index({ isPublic: 1 });
customListSchema.index({ owner: 1, order: 1 });

const CustomList = mongoose.model("CustomList", customListSchema);
export default CustomList;
