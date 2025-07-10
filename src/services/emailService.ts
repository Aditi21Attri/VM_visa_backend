import nodemailer from 'nodemailer';
import { INotification } from '../models/Notification';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendEmail(data: EmailData): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Email would be sent:', data);
        return true;
      }

      const info = await this.transporter.sendMail({
        from: `"VM Visa Platform" <${process.env.EMAIL_USER}>`,
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html
      });

      console.log('Message sent: %s', info.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error);
      return false;
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to VM Visa Platform!</h2>
        <p>Dear ${name},</p>
        <p>Thank you for joining VM Visa Platform. We're excited to help you with your immigration needs.</p>
        <p>You can now:</p>
        <ul>
          <li>Submit visa requests</li>
          <li>Connect with certified agents</li>
          <li>Track your application progress</li>
          <li>Manage documents securely</li>
        </ul>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <p>Best regards,<br>The VM Visa Team</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to VM Visa Platform',
      html,
      text: `Welcome to VM Visa Platform, ${name}! Thank you for joining us.`
    });
  }

  async sendProposalNotification(email: string, name: string, proposalId: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Proposal Received</h2>
        <p>Dear ${name},</p>
        <p>You have received a new proposal for your visa request.</p>
        <p>Please log in to your account to review the proposal details.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard/my-requests" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Proposal
        </a>
        <p>Best regards,<br>The VM Visa Team</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'New Proposal Received - VM Visa',
      html
    });
  }

  async sendStatusUpdateEmail(email: string, name: string, status: string, requestTitle: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Status Update</h2>
        <p>Dear ${name},</p>
        <p>Your visa request "${requestTitle}" has been updated to: <strong>${status}</strong></p>
        <p>Please log in to your account for more details.</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" 
           style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          View Dashboard
        </a>
        <p>Best regards,<br>The VM Visa Team</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `Status Update: ${requestTitle} - VM Visa`,
      html
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Password Reset Request</h2>
        <p>You have requested to reset your password for VM Visa Platform.</p>
        <p>Click the link below to reset your password:</p>
        <a href="${process.env.FRONTEND_URL}/reset-password?token=${resetToken}" 
           style="background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Reset Password
        </a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The VM Visa Team</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Password Reset - VM Visa Platform',
      html
    });
  }
}

export default new EmailService();
