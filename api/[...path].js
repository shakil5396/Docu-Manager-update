const { app } = require('../backend/server');
const { connectDatabase } = require('../backend/config/db');

let databaseConnection;

module.exports = async function handler(request, response) {
  try {
    if (!databaseConnection) {
      databaseConnection = connectDatabase().catch(error => {
        databaseConnection = undefined;
        throw error;
      });
    }
    await databaseConnection;
    return app(request, response);
  } catch (error) {
    console.error('Serverless request startup failed:', error.message);
    return response.status(503).json({ success: false, message: 'The service is temporarily unavailable.' });
  }
};
