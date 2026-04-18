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

// CRUD operations
familyRouter
  .route("/")
  .post(createFamily)
  .get(getAllFamilies);

familyRouter
  .route("/:id")
  .get(getFamilyById)
  .patch(updateFamily)
  .delete(deleteFamily);

// Family fee summary
familyRouter.get("/:id/fee-summary", getFamilyFeeSummary);

// Link/unlink students
familyRouter.post("/link-student", authorize('Admin'), linkStudentToFamily);
familyRouter.delete("/unlink-student/:studentId", authorize('Admin'), unlinkStudentFromFamily);

// Generate family ID
familyRouter.get("/generate/id", generateFamilyId);

export default familyRouter;
