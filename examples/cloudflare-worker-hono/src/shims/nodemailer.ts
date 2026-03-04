function unsupported(): never {
  throw new Error(
    'nodemailer is not supported in the Cloudflare Worker example.',
  );
}

export function createTransport() {
  return unsupported();
}

export async function createTestAccount() {
  return unsupported();
}

export function getTestMessageUrl() {
  return false;
}

const nodemailer = {
  createTransport,
  createTestAccount,
  getTestMessageUrl,
};

export default nodemailer;
