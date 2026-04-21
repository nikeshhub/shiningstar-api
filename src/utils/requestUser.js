export const getRequestUserId = (req) => req.user?.id || req.user?._id || null;

export const getRequestTeacherId = (req) => {
  if (req.user?.profileModel !== "Teacher") {
    return null;
  }

  return req.user.profile || null;
};

export const getRequestFamilyId = (req) => {
  if (req.user?.profileModel !== "Family") {
    return null;
  }

  return req.user.profile || null;
};
