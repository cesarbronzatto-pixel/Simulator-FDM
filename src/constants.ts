export const ADMIN_EMAILS = [
  'caio.vidal@xertica.com',
  'cesar.bronzatto@xertica.com',
  'renata.perina@xertica.com',
  'gustavo.paula@xertica.com',
  'desyre.guerrero@xertica.com'
];

export const isAdmin = (email?: string | null) => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
};
