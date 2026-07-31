import i18next from 'i18next';
import enCommon from '../locales/en/common.json';
import frCommon from '../locales/fr/common.json';
import enEconomy from '../locales/en/economy.json';
import frEconomy from '../locales/fr/economy.json';
import enFun from '../locales/en/fun.json';
import frFun from '../locales/fr/fun.json';
import enMod from '../locales/en/mod.json';
import frMod from '../locales/fr/mod.json';
import enUsers from '../locales/en/users.json';
import frUsers from '../locales/fr/users.json';

await i18next.init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common', 'economy', 'fun', 'mod', 'users'],
    defaultNS: 'common',
    // Interpolated values (e.g. Discord mentions like <@id>) must not be
    // HTML-escaped — this isn't rendered as HTML, it's sent to Discord.
    interpolation: { escapeValue: false },
    resources: {
        en: {
            common: enCommon,
            economy: enEconomy,
            fun: enFun,
            mod: enMod,
            users: enUsers,
        },
        fr: {
            common: frCommon,
            economy: frEconomy,
            fun: frFun,
            mod: frMod,
            users: frUsers,
        },
    },
});

export class I18nService {
    public static translate(key: string, options?: any): string {
        return i18next.t(key, options) as string;
    }
}
