/**
 * API Route: GET /api/v1/notifications/socket
 * Socket.io endpoint cho real-time notifications
 */

import { createServer }from 'http';
import type { NextApiRequest, NextApiResponse }from 'next';
import { getNotificationManager }from '@/lib/notifications';
import { logInfo }from '@/lib/logger';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Initialize Socket.io server
 */
let socketIOInitialized = false;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!socketIOInitialized) {
    const httpServer = res.socket.server as any;
    
    if (!httpServer.io) {
      logInfo('Initializing Socket.io server');
      const notificationManager = getNotificationManager();
      notificationManager.initialize(httpServer);
      httpServer.io = notificationManager.getIO();
      socketIOInitialized = true;
    }
  }

  res.end();
}
