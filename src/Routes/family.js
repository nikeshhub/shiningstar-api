import { Router } from "express";
import {
  createFamily,
  getAllFamilies,
  getFamilyById,
  updateFamily,
  deleteFamily,
  getFamilyFeeSummary,
  linkStudentToFamily,
  unlinkStudentFromFamily,
  generateFamilyId
} from "../Controller/family.js";
import { authorize } from "../Middleware/auth.js";

let familyRouter = Router();

// Generate family ID
familyRouter.get("/generate/id", authorize('Admin'), generateFamilyId);

// CRUD operations
familyRouter
  .route("/")
  .post(authorize('Admin'), createFamily)
  .get(authorize('Admin', 'Parent'), getAllFamilies);

familyRouter
  .route("/:id")
  .get(authorize('Admin', 'Parent'), getFamilyById)
  .patch(authorize('Admin'), updateFamily)
  .delete(authorize('Admin'), deleteFamily);

// Family fee summary
familyRouter.get("/:id/fee-summary", authorize('Admin', 'Parent'), getFamilyFeeSummary);

// Link/unlink students
familyRouter.post("/link-student", authorize('Admin'), linkStudentToFamily);
familyRouter.delete("/unlink-student/:studentId", authorize('Admin'), unlinkStudentFromFamily);

export default familyRouter;
