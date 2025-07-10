import Stripe from 'stripe';

interface PaymentIntentData {
  amount: number;
  currency: string;
  customerId?: string;
  metadata?: { [key: string]: string };
}

interface RefundData {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}

class PaymentService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16'
    });
  }

  // Create payment intent
  async createPaymentIntent(data: PaymentIntentData): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency || 'usd',
        customer: data.customerId,
        metadata: data.metadata || {},
        automatic_payment_methods: {
          enabled: true
        }
      });

      return paymentIntent;
    } catch (error) {
      console.error('Stripe payment intent creation error:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Confirm payment intent
  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe payment confirmation error:', error);
      throw new Error('Failed to confirm payment');
    }
  }

  // Get payment intent
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Stripe payment intent retrieval error:', error);
      throw new Error('Failed to retrieve payment intent');
    }
  }

  // Create customer
  async createCustomer(email: string, name: string, metadata?: { [key: string]: string }): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        metadata: metadata || {}
      });

      return customer;
    } catch (error) {
      console.error('Stripe customer creation error:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Create refund
  async createRefund(data: RefundData): Promise<Stripe.Refund> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: data.paymentIntentId,
        amount: data.amount ? Math.round(data.amount * 100) : undefined,
        reason: data.reason as Stripe.RefundCreateParams.Reason || 'requested_by_customer'
      });

      return refund;
    } catch (error) {
      console.error('Stripe refund creation error:', error);
      throw new Error('Failed to create refund');
    }
  }

  // Handle webhook
  async handleWebhook(body: string | Buffer, signature: string): Promise<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || ''
      );

      return event;
    } catch (error) {
      console.error('Stripe webhook verification error:', error);
      throw new Error('Invalid webhook signature');
    }
  }

  // Calculate platform fee
  calculatePlatformFee(amount: number, feePercentage: number = 3): { fee: number; netAmount: number } {
    const fee = Math.round(amount * (feePercentage / 100) * 100) / 100;
    const netAmount = amount - fee;
    
    return { fee, netAmount };
  }

  // Create setup intent for saving payment methods
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card']
      });

      return setupIntent;
    } catch (error) {
      console.error('Stripe setup intent creation error:', error);
      throw new Error('Failed to create setup intent');
    }
  }

  // List customer payment methods
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Stripe payment methods listing error:', error);
      throw new Error('Failed to list payment methods');
    }
  }

  // Create account for agents (for marketplace)
  async createConnectedAccount(email: string, businessType: 'individual' | 'company' = 'individual'): Promise<Stripe.Account> {
    try {
      const account = await this.stripe.accounts.create({
        type: 'express',
        email,
        business_type: businessType,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });

      return account;
    } catch (error) {
      console.error('Stripe connected account creation error:', error);
      throw new Error('Failed to create connected account');
    }
  }

  // Create account link for onboarding
  async createAccountLink(accountId: string, returnUrl: string, refreshUrl: string): Promise<Stripe.AccountLink> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        return_url: returnUrl,
        refresh_url: refreshUrl,
        type: 'account_onboarding'
      });

      return accountLink;
    } catch (error) {
      console.error('Stripe account link creation error:', error);
      throw new Error('Failed to create account link');
    }
  }

  // Transfer money to connected account
  async createTransfer(amount: number, destination: string, metadata?: { [key: string]: string }): Promise<Stripe.Transfer> {
    try {
      const transfer = await this.stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        destination,
        metadata: metadata || {}
      });

      return transfer;
    } catch (error) {
      console.error('Stripe transfer creation error:', error);
      throw new Error('Failed to create transfer');
    }
  }
}

export default new PaymentService();
