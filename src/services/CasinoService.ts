import { EconomyService } from "./EconomyService.js";

export class CasinoService {
  /**
   * Double or Nothing game.
   * 50% chance to win double the bet, 50% chance to lose it.
   */
  public static async doubleOrNothing(discordId: string, bet: number) {
    if (bet <= 0) throw new Error("Bet must be positive");
    
    // Will throw if insufficient funds
    await EconomyService.removeBalance(discordId, bet);
    
    const isWin = Math.random() >= 0.5;
    
    if (isWin) {
      await EconomyService.addBalance(discordId, bet * 2);
      return { win: true, amount: bet * 2 };
    } else {
      return { win: false, amount: 0 };
    }
  }

  /**
   * Coinflip game.
   * Bet on "heads" or "tails".
   */
  public static async coinflip(discordId: string, bet: number, choice: "heads" | "tails") {
    if (bet <= 0) throw new Error("Bet must be positive");
    
    await EconomyService.removeBalance(discordId, bet);
    
    const result = Math.random() >= 0.5 ? "heads" : "tails";
    const isWin = choice === result;
    
    if (isWin) {
      await EconomyService.addBalance(discordId, bet * 2);
      return { win: true, amount: bet * 2, result };
    } else {
      return { win: false, amount: 0, result };
    }
  }

  /**
   * Rock Paper Scissors game.
   * Bet an amount against the bot.
   */
  public static async rps(discordId: string, bet: number, choice: "rock" | "paper" | "scissors") {
    if (bet <= 0) throw new Error("Bet must be positive");
    
    await EconomyService.removeBalance(discordId, bet);
    
    const choices = ["rock", "paper", "scissors"] as const;
    const botChoice = choices[Math.floor(Math.random() * choices.length)];
    
    let result: "win" | "lose" | "tie" = "lose";
    
    if (choice === botChoice) {
      result = "tie";
    } else if (
      (choice === "rock" && botChoice === "scissors") ||
      (choice === "paper" && botChoice === "rock") ||
      (choice === "scissors" && botChoice === "paper")
    ) {
      result = "win";
    }
    
    if (result === "win") {
      await EconomyService.addBalance(discordId, bet * 2);
      return { state: result, botChoice, returnAmount: bet * 2 };
    } else if (result === "tie") {
      await EconomyService.addBalance(discordId, bet); // Refund
      return { state: result, botChoice, returnAmount: bet };
    } else {
      return { state: result, botChoice, returnAmount: 0 };
    }
  }

  /**
   * Slots game.
   * Simple 3-reel slot machine.
   */
  public static async slots(discordId: string, bet: number) {
    if (bet <= 0) throw new Error("Bet must be positive");
    
    await EconomyService.removeBalance(discordId, bet);
    
    const symbols = ["🍒", "🍋", "🍇", "🍉", "⭐", "💎"];
    const reel1 = symbols[Math.floor(Math.random() * symbols.length)];
    const reel2 = symbols[Math.floor(Math.random() * symbols.length)];
    const reel3 = symbols[Math.floor(Math.random() * symbols.length)];
    
    let multiplier = 0;
    if (reel1 === reel2 && reel2 === reel3) {
      if (reel1 === "💎") multiplier = 10;
      else if (reel1 === "⭐") multiplier = 5;
      else multiplier = 3;
    } else if (reel1 === reel2 || reel2 === reel3 || reel1 === reel3) {
      multiplier = 1.5;
    }
    
    const winAmount = Math.floor(bet * multiplier);
    if (winAmount > 0) {
      await EconomyService.addBalance(discordId, winAmount);
    }
    
    return {
      reels: [reel1, reel2, reel3],
      win: winAmount > 0,
      winAmount
    };
  }
}
