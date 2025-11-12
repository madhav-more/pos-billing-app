import User from '../models/User.js';

export const resolveCompanyCode = async (req) => {
  if (req.user?.companyCode) {
    return req.user.companyCode.toUpperCase();
  }

  if (req.user?.company_code) {
    return req.user.company_code.toUpperCase();
  }

  if (req.user?.userId) {
    const user = await User.findById(req.user.userId);
    if (user?.company_code) {
      return user.company_code.toUpperCase();
    }
  }

  if (req.headers['x-company-code']) {
    return req.headers['x-company-code'].toString().toUpperCase();
  }

  return null;
};
