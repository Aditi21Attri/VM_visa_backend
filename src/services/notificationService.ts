import { Server } from 'socket.io';
import Notification, { INotification } from '../models/Notification';
import emailService from './emailService';

interface CreateNotificationData {
  recipient: string;
  sender?: string;
  type: INotification['type'];
  title: string;
  message: string;
  data?: any;
  link?: string;
  priority?: INotification['priority'];
  category?: INotification['category'];
  channels?: INotification['channels'];
}

class NotificationService {
  private io?: Server;

  setIO(io: Server) {
    this.io = io;
  }

  async createNotification(data: CreateNotificationData): Promise<INotification> {
    const notification = new Notification({
      recipient: data.recipient,
      sender: data.sender,
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      link: data.link,
      priority: data.priority || 'medium',
      category: data.category || 'info',
      channels: data.channels || ['in_app']
    });

    await notification.save();
    await notification.populate('sender', 'firstName lastName avatar');

    // Send real-time notification
    this.sendRealTimeNotification(data.recipient, notification);

    // Send email if channel includes email
    if (data.channels?.includes('email')) {
      this.sendEmailNotification(notification);
    }

    return notification;
  }

  private sendRealTimeNotification(userId: string, notification: INotification) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit('notification', {
        id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        category: notification.category,
        link: notification.link,
        sender: notification.sender,
        createdAt: notification.createdAt
      });
    }
  }

  private async sendEmailNotification(notification: INotification) {
    try {
      // You would populate recipient with email here
      const populatedNotification = await Notification
        .findById(notification._id)
        .populate('recipient', 'email firstName lastName');

      if (populatedNotification?.recipient) {
        const recipient = populatedNotification.recipient as any;
        await emailService.sendEmail({
          to: recipient.email,
          subject: notification.title,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>${notification.title}</h2>
              <p>${notification.message}</p>
              ${notification.link ? `
                <a href="${notification.link}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
                  View Details
                </a>
              ` : ''}
              <p>Best regards,<br>The VM Visa Team</p>
            </div>
          `,
          text: notification.message
        });

        // Update email sent status
        await Notification.findByIdAndUpdate(notification._id, {
          emailSent: true
        });
      }
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  }

  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      );
      return !!result;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      await Notification.updateMany(
        { recipient: userId, isRead: false },
        { 
          isRead: true, 
          readAt: new Date() 
        }
      );
      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }

  async getNotifications(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    unreadOnly: boolean = false
  ) {
    try {
      const query: any = { recipient: userId };
      if (unreadOnly) {
        query.isRead = false;
      }

      const notifications = await Notification
        .find(query)
        .populate('sender', 'firstName lastName avatar')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

      const total = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        isRead: false
      });

      return {
        notifications,
        total,
        unreadCount,
        page,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Failed to get notifications:', error);
      throw error;
    }
  }

  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId
      });
      return !!result;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  // Helper methods for common notification types
  async notifyNewMessage(recipientId: string, senderId: string, conversationId: string) {
    return this.createNotification({
      recipient: recipientId,
      sender: senderId,
      type: 'message',
      title: 'New Message',
      message: 'You have received a new message',
      link: `/messages/${conversationId}`,
      priority: 'medium',
      category: 'info',
      channels: ['in_app', 'email']
    });
  }

  async notifyNewProposal(clientId: string, agentId: string, proposalId: string) {
    return this.createNotification({
      recipient: clientId,
      sender: agentId,
      type: 'proposal',
      title: 'New Proposal Received',
      message: 'You have received a new proposal for your visa request',
      link: `/dashboard/my-requests`,
      priority: 'high',
      category: 'success',
      channels: ['in_app', 'email']
    });
  }

  async notifyStatusUpdate(userId: string, type: string, title: string, status: string) {
    return this.createNotification({
      recipient: userId,
      type: 'status_update',
      title: `${title} Status Update`,
      message: `Your ${type} status has been updated to: ${status}`,
      link: '/dashboard',
      priority: 'high',
      category: 'info',
      channels: ['in_app', 'email']
    });
  }

  async notifyPaymentUpdate(userId: string, amount: number, status: string) {
    return this.createNotification({
      recipient: userId,
      type: 'payment',
      title: 'Payment Update',
      message: `Your payment of $${amount} is now ${status}`,
      link: '/dashboard/payments',
      priority: 'high',
      category: status === 'completed' ? 'success' : 'warning',
      channels: ['in_app', 'email']
    });
  }
}

export default new NotificationService();
