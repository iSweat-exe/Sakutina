import { eq } from "drizzle-orm";
import { db } from "../repositories/db.js";
import { users } from "../repositories/schema.js";

export class EconomyService {
  /**
   * Ensure user exists in the database.
   */
  public static async ensureUser(discordId: string) {
    let user = await db.select().from(users).where(eq(users.discordId, discordId)).then(res => res[0]);
    if (!user) {
      user = (await db.insert(users).values({ discordId }).returning().then(res => res[0]))!;
    }
    return user;
  }

  /**
   * Get a user's balances (wallet + bank).
   */
  public static async getBalance(discordId: string) {
    const user = await this.ensureUser(discordId);
    return { balance: user.balance, bank: user.bank };
  }

  /**
   * Add funds to a user's wallet.
   */
  public static async addBalance(discordId: string, amount: number) {
    if (amount < 0) throw new Error("Amount must be positive");
    const user = await this.ensureUser(discordId);
    const updated = (await db.update(users)
      .set({ balance: user.balance + amount, updatedAt: new Date() })
      .where(eq(users.discordId, discordId))
      .returning().then(res => res[0]))!;
    return updated.balance;
  }

  /**
   * Remove funds from a user's wallet.
   */
  public static async removeBalance(discordId: string, amount: number) {
    if (amount < 0) throw new Error("Amount must be positive");
    const user = await this.ensureUser(discordId);
    if (user.balance < amount) throw new Error("INSUFFICIENT_FUNDS");
    
    const updated = (await db.update(users)
      .set({ balance: user.balance - amount, updatedAt: new Date() })
      .where(eq(users.discordId, discordId))
      .returning().then(res => res[0]))!;
    return updated.balance;
  }

  /**
   * Pay another user from wallet to wallet.
   */
  public static async payUser(senderId: string, receiverId: string, amount: number) {
    if (amount <= 0) throw new Error("Amount must be positive");
    if (senderId === receiverId) throw new Error("CANNOT_PAY_SELF");

    const sender = await this.ensureUser(senderId);
    if (sender.balance < amount) throw new Error("INSUFFICIENT_FUNDS");

    await this.ensureUser(receiverId);

    // Transaction-like logic (though we just do it sequentially for now)
    await this.removeBalance(senderId, amount);
    await this.addBalance(receiverId, amount);
  }

  /**
   * Claim daily rewards.
   */
  public static async claimDaily(discordId: string, rewardAmount: number = 500) {
    const user = await this.ensureUser(discordId);
    
    const now = new Date();
    // 24 hours cooldown
    if (user.dailyLastClaim) {
      const diffHours = (now.getTime() - user.dailyLastClaim.getTime()) / (1000 * 60 * 60);
      if (diffHours < 24) {
        const remainingHours = (24 - diffHours).toFixed(1);
        throw new Error(`COOLDOWN:${remainingHours}`);
      }
    }

    const updated = (await db.update(users)
      .set({ 
        balance: user.balance + rewardAmount, 
        dailyLastClaim: now,
        updatedAt: new Date()
      })
      .where(eq(users.discordId, discordId))
      .returning().then(res => res[0]))!;
      
      return updated.balance;
  }

  /**
   * Get the richest users (wallet + bank).
   */
  public static async getLeaderboard(limit: number = 10) {
    const allUsers = await db.select().from(users);
    
    // Calculate total and sort in memory (since we don't have a computed column)
    return allUsers
      .map(u => ({ discordId: u.discordId, total: u.balance + u.bank }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }
}
