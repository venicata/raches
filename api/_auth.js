import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Checks the 'x-admin-key' header against the ADMIN_KEY_PASS environment variable.
 */
export function isAdminAuthorized(request) {
    const provided = request.headers['x-admin-key'];
    const expected = process.env.ADMIN_KEY_PASS;
    return !!expected && !!provided && provided === expected;
}
