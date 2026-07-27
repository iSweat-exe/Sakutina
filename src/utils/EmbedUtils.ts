import { EmbedBuilder, type ColorResolvable, type User } from "discord.js";

export const EmbedColors = {
  Success: "#2ECC71" as ColorResolvable,
  Error: "#E74C3C" as ColorResolvable,
  Warning: "#F1C40F" as ColorResolvable,
  Info: "#3498DB" as ColorResolvable,
  Primary: "#9B59B6" as ColorResolvable,
};

export class EmbedUtils {
  /**
   * Creates a base embed with standard formatting
   */
  static base(options?: {
    title?: string;
    description?: string;
    color?: ColorResolvable;
    user?: User;
  }): EmbedBuilder {
    const embed = new EmbedBuilder();
    
    if (options?.title) embed.setTitle(options.title);
    if (options?.description) embed.setDescription(options.description);
    if (options?.color) embed.setColor(options.color);
    else embed.setColor(EmbedColors.Primary);

    if (options?.user) {
      embed.setFooter({
        text: `Requested by ${options.user.username}`,
        iconURL: options.user.displayAvatarURL(),
      });
      embed.setTimestamp();
    }

    return embed;
  }

  /**
   * Creates a success embed (Green)
   */
  static success(description: string, title: string = "✅ Success", user?: User): EmbedBuilder {
    return this.base({ title, description, color: EmbedColors.Success, user });
  }

  /**
   * Creates an error embed (Red)
   */
  static error(description: string, title: string = "❌ Error", user?: User): EmbedBuilder {
    return this.base({ title, description, color: EmbedColors.Error, user });
  }

  /**
   * Creates a warning embed (Yellow)
   */
  static warn(description: string, title: string = "⚠️ Warning", user?: User): EmbedBuilder {
    return this.base({ title, description, color: EmbedColors.Warning, user });
  }

  /**
   * Creates an info embed (Blue)
   */
  static info(description: string, title: string = "ℹ️ Information", user?: User): EmbedBuilder {
    return this.base({ title, description, color: EmbedColors.Info, user });
  }
}
