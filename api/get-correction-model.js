import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const MODEL_KEY = 'prediction_model_v4';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const model = await redis.get(MODEL_KEY);
        if (!model) {
            // Ако модел все още не е генериран, връщаме празен обект
            return response.status(200).json({});
        }
        // Upstash SDK автоматично парсва JSON, ако е обект
        response.status(200).json(model);
    } catch (error) {
        console.error('Error fetching prediction model from Redis:', error);
        response.status(500).json({ error: 'Failed to fetch prediction model' });
    }
}
