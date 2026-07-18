import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Verifies the admin password against ADMIN_KEY_PASS. Used by the admin login modal
 * instead of the old ?admin=true URL flag.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const { password } = request.body || {};
    const expected = process.env.ADMIN_KEY_PASS;

    if (!expected || password !== expected) {
        return response.status(401).json({ success: false, error: 'Грешна парола' });
    }

    return response.status(200).json({ success: true });
}
