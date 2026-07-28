import fs from 'fs';
import path from 'path';

const actions = [
    { name: 'hug', en: ['wants a hug!', 'hugged', 'Hug Back'], fr: ['veut un câlin !', 'a fait un câlin à', 'Rendre le câlin'] },
    { name: 'cuddle', en: ['wants to cuddle!', 'cuddled', 'Cuddle Back'], fr: ['veut faire un câlin !', 'a fait un câlin tendre à', 'Rendre le câlin'] },
    { name: 'sleep', en: ['is sleeping zZz', 'fell asleep with', 'Sleep Back'], fr: ['s\'est endormi zZz', 's\'est endormi avec', 'Dormir avec'] },
    { name: 'confused', en: ['is confused...', 'is confused by', 'Be confused too'], fr: ['est confus...', 'est confus face à', 'Être confus aussi'] },
    { name: 'blush', en: ['is blushing!', 'blushed at', 'Blush Back'], fr: ['rougit !', 'a rougi devant', 'Rougir aussi'] },
    { name: 'think', en: ['is thinking deeply.', 'is thinking about', 'Think Back'], fr: ['réfléchit intensément.', 'réfléchit à', 'Réfléchir aussi'] },
    { name: 'highfive', en: ['wants a highfive!', 'high-fived', 'High-five Back'], fr: ['veut taper dans la main !', 'a tapé dans la main de', 'Taper dans la main'] },
    { name: 'bite', en: ['is biting!', 'bit', 'Bite Back'], fr: ['mord dans le vide !', 'a mordu', 'Mordre en retour'] },
    { name: 'shocked', en: ['is shocked!', 'is shocked by', 'Be shocked too'], fr: ['est choqué !', 'est choqué par', 'Être choqué aussi'] },
    { name: 'bleh', en: ['goes bleh :P', 'went bleh at', 'Bleh Back'], fr: ['tire la langue :P', 'a tiré la langue à', 'Tirer la langue'] },
    { name: 'bored', en: ['is extremely bored.', 'is bored with', 'Be bored together'], fr: ['s\'ennuie à mourir.', 's\'ennuie avec', 'S\'ennuyer ensemble'] },
    { name: 'nya', en: ['goes nya~!', 'nya\'d at', 'Nya Back'], fr: ['fait nya~ !', 'a fait nya à', 'Faire nya en retour'] },
    { name: 'pat', en: ['wants headpats!', 'patted', 'Pat Back'], fr: ['veut des pat-pats !', 'a fait des pat-pats à', 'Faire des pat-pats'] },
    { name: 'angry', en: ['is angry!', 'is angry at', 'Be angry too'], fr: ['est en colère !', 'est en colère contre', 'Être en colère aussi'] },
    { name: 'kiss', en: ['wants a kiss!', 'kissed', 'Kiss Back'], fr: ['veut un bisou !', 'a fait un bisou à', 'Rendre le bisou'] },
    { name: 'handshake', en: ['offers a handshake.', 'shook hands with', 'Shake Back'], fr: ['propose une poignée de main.', 'a serré la main de', 'Serrer la main'] },
    { name: 'cry', en: ['is crying TT', 'is crying on', 'Cry together'], fr: ['pleure TT', 'pleure sur l\'épaule de', 'Pleurer ensemble'] },
    { name: 'lappillow', en: ['wants a lap pillow.', 'gave a lap pillow to', 'Return Lap Pillow'], fr: ['veut des genoux pour dormir.', 'a prêté ses genoux à', 'Prêter ses genoux'] },
    { name: 'blowkiss', en: ['blows a kiss~', 'blew a kiss to', 'Blow Kiss Back'], fr: ['envoie un bisou volant~', 'a envoyé un bisou volant à', 'Rendre le bisou volant'] },
    { name: 'waifu', en: ['feels like a waifu!', 'claimed as waifu:', 'Claim Back'], fr: ['se sent comme une waifu !', 'a réclamé comme waifu :', 'Réclamer en retour'] },
    { name: 'laugh', en: ['is laughing loudly!', 'laughed with', 'Laugh together'], fr: ['rigole très fort !', 'a rigolé avec', 'Rigoler ensemble'] },
    { name: 'thumbsup', en: ['gives a thumbs up!', 'gave a thumbs up to', 'Thumbs Up Back'], fr: ['lève le pouce !', 'a levé le pouce pour', 'Lever le pouce'] },
    { name: 'shake', en: ['is shaking.', 'shook', 'Shake Back'], fr: ['tremble.', 'a secoué', 'Secouer en retour'] },
    { name: 'yawn', en: ['yawns~', 'yawned at', 'Yawn together'], fr: ['baille~', 'a baillé devant', 'Bailler ensemble'] },
];

const updateLang = (lang: string, arrIdx: number) => {
    const file = path.join(__dirname, `../locales/${lang}/common.json`);
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    
    // Clean old interact keys
    Object.keys(data).forEach(k => {
        if (k.startsWith('INTERACT_') && !['INTERACT_SELF_ERROR', 'INTERACT_BOT_ERROR', 'INTERACT_BTN_NOT_TARGET'].includes(k)) {
            delete data[k];
        }
    });

    for (const act of actions) {
        const up = act.name.toUpperCase();
        data[`INTERACT_${up}`] = `**{{user}}** ${(act as any)[lang][0]}`;
        data[`INTERACT_${up}_TARGET`] = `**{{user}}** ${(act as any)[lang][1]} **{{target}}**!`;
        data[`INTERACT_${up}_BACK`] = `**{{target}}** ${(act as any)[lang][1]} **{{user}}**!`; // Generic back
        data[`INTERACT_BTN_${up}`] = (act as any)[lang][2];
    }
    
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}

updateLang('en', 1);
updateLang('fr', 2);

console.log('Translations updated!');
