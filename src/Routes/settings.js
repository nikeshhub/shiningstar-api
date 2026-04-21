import { Router } from "express";
import { Settings } from "../Model/model.js";
import { handleError } from "../utils/errorHandler.js";
import { authorize } from "../Middleware/auth.js";

const settingsRouter = Router();

// GET /api/settings — returns (or auto-creates) the singleton settings doc
settingsRouter.get("/", async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { $setOnInsert: { activeAcademicYear: "2081-82" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    handleError(res, error);
  }
});

// PUT /api/settings — update active academic year (and any future settings)
settingsRouter.put("/", authorize('Admin'), async (req, res) => {
  try {
    const { activeAcademicYear } = req.body;
    if (!activeAcademicYear) {
      return res.status(400).json({ success: false, message: "activeAcademicYear is required" });
    }
    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: { activeAcademicYear } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, message: "Settings updated", data: settings });
  } catch (error) {
    handleError(res, error);
  }
});

export default settingsRouter;
