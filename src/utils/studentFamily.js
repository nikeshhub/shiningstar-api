const pickContact = (family) => {
  if (!family) {
    return {
      parentName: null,
      parentRelation: null,
      parentContact: null,
      parentEmail: null,
      address: null,
      familyId: null,
    };
  }

  const primaryContact = family.primaryContact || {};
  const secondaryContact = family.secondaryContact || {};

  return {
    parentName: primaryContact.name || secondaryContact.name || null,
    parentRelation: primaryContact.relation || secondaryContact.relation || null,
    parentContact: primaryContact.mobile || secondaryContact.mobile || null,
    parentEmail: primaryContact.email || secondaryContact.email || null,
    address: family.address || null,
    familyId: family.familyId || null,
  };
};

const trimFamilyForStudentPayload = (family, { includeFamilyFeeBalance = true } = {}) => {
  if (!family) {
    return family;
  }

  const familyData =
    typeof family?.toObject === "function" ? family.toObject() : { ...family };

  if (!includeFamilyFeeBalance) {
    delete familyData.familyFeeBalance;
  }

  return familyData;
};

export const withFamilyContact = (studentDoc, options = {}) => {
  const student =
    typeof studentDoc?.toObject === "function" ? studentDoc.toObject() : studentDoc;

  if (!student) {
    return student;
  }

  return {
    ...student,
    family: trimFamilyForStudentPayload(student.family, options),
    ...pickContact(student.family),
  };
};

export const withFamilyContactList = (students = [], options = {}) =>
  students.map((student) => withFamilyContact(student, options));
