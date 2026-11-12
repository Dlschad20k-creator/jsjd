import type { MapId } from './protocol';

export type Place = 'road' | 'edge' | 'city' | 'park' | 'plaza' | 'any' | 'landmark';
export type Sfx = 'crunch' | 'squeak' | 'honk' | 'boing' | 'glass' | 'metal' | 'thud' | 'splat';
export type Anim = 'hop' | 'bob' | 'spin' | 'sway';

export interface KindDef {
  id: string;
  name: string;
  r: number; // footprint radius in world units
  place: Place[];
  count: number;
  sfx?: Sfx;
  anim?: Anim;
  quips?: string[];
}

export interface MapDef {
  id: MapId;
  name: string;
  subtitle: string;
  description: string;
  ui: { accent: string; accent2: string; glow: string };
  winQuips: string[];
  killQuips: string[];
  kinds: KindDef[];
}

const pink: MapDef = {
  id: 'pink',
  name: 'Pink Dream World',
  subtitle: 'Dream houses · fashion · fabulous cars',
  description: 'A glittering pink fashion city full of dream houses, boutiques, convertibles and sparkle.',
  ui: { accent: '#ff4fb8', accent2: '#ffc2e6', glow: 'rgba(255,79,184,0.55)' },
  winQuips: ['Absolutely fabulous!', 'Slay, queen!', 'Iconic.'],
  killQuips: ['got glamorously gobbled!', 'was sent to the fashion void!', 'fell out of style!'],
  kinds: [
    { id: 'dream_castle', name: 'Dream Castle', r: 11.5, place: ['landmark'], count: 1, sfx: 'thud', quips: ['THE CASTLE?!'] },
    { id: 'ferris_wheel', name: 'Glitter Ferris Wheel', r: 10, place: ['landmark'], count: 1, sfx: 'metal' },
    { id: 'mansion', name: 'Dream Mansion', r: 7, place: ['city'], count: 13, sfx: 'thud' },
    { id: 'fashion_tower', name: 'Fashion Tower', r: 6.5, place: ['city'], count: 13, sfx: 'glass' },
    { id: 'dream_house', name: 'Dream House', r: 4.5, place: ['city'], count: 22, sfx: 'thud' },
    { id: 'boutique', name: 'Boutique', r: 4, place: ['city', 'plaza'], count: 16, sfx: 'glass' },
    { id: 'carousel', name: 'Pony Carousel', r: 4.2, place: ['plaza', 'park'], count: 6, sfx: 'metal' },
    { id: 'fountain', name: 'Heart Fountain', r: 3.4, place: ['plaza', 'park'], count: 6, sfx: 'splat' },
    { id: 'limo', name: 'Pink Limo', r: 3, place: ['road'], count: 8, sfx: 'honk', quips: ['VIP only!'] },
    { id: 'convertible', name: 'Convertible', r: 1.9, place: ['road'], count: 40, sfx: 'honk' },
    { id: 'palm', name: 'Palm Tree', r: 1.6, place: ['park', 'edge', 'plaza'], count: 50, sfx: 'crunch' },
    { id: 'ice_cream_cart', name: 'Ice Cream Cart', r: 1.6, place: ['plaza', 'park'], count: 14, sfx: 'splat' },
    { id: 'heart_bench', name: 'Heart Bench', r: 1.5, place: ['park', 'plaza', 'edge'], count: 25, sfx: 'thud' },
    { id: 'vespa', name: 'Scooter', r: 1.2, place: ['road', 'edge'], count: 25, sfx: 'honk' },
    { id: 'doll_npc', name: 'Fashionista', r: 0.8, place: ['edge', 'plaza', 'park'], count: 40, anim: 'bob', sfx: 'squeak', quips: ['Like, totally!', 'My hair!'] },
    { id: 'flamingo', name: 'Flamingo', r: 0.75, place: ['park', 'plaza', 'any'], count: 40, sfx: 'squeak' },
    { id: 'poodle', name: 'Poodle', r: 0.7, place: ['edge', 'park', 'any'], count: 30, anim: 'hop', sfx: 'squeak', quips: ['Yip!'] },
    { id: 'gift_box', name: 'Gift Box', r: 0.7, place: ['any', 'plaza'], count: 40, sfx: 'crunch' },
    { id: 'heart_lamp', name: 'Heart Lamp', r: 0.7, place: ['edge'], count: 40, sfx: 'metal' },
    { id: 'flower_pot', name: 'Flower Pot', r: 0.6, place: ['edge', 'plaza'], count: 40, sfx: 'crunch' },
    { id: 'hydrant', name: 'Pink Hydrant', r: 0.55, place: ['edge'], count: 30, sfx: 'metal' },
    { id: 'handbag', name: 'Handbag', r: 0.45, place: ['any'], count: 50, sfx: 'squeak' },
    { id: 'cupcake', name: 'Cupcake', r: 0.4, place: ['any'], count: 50, sfx: 'splat' },
    { id: 'high_heel', name: 'High Heel', r: 0.35, place: ['any'], count: 50, sfx: 'squeak' },
    { id: 'perfume', name: 'Perfume', r: 0.35, place: ['any'], count: 40, sfx: 'glass' },
    { id: 'lipstick', name: 'Lipstick', r: 0.3, place: ['any'], count: 60, sfx: 'squeak' },
    { id: 'heart_candy', name: 'Heart Candy', r: 0.3, place: ['any'], count: 60, sfx: 'crunch' },
  ],
};

const bunny: MapDef = {
  id: 'bunny',
  name: 'Baby Bunny World',
  subtitle: 'Bunnies · giant carrots · pastel magic',
  description: 'A soft pastel wonderland of hopping bunnies, giant carrots, toys, flowers and mushroom houses.',
  ui: { accent: '#8fd3ff', accent2: '#ffe3a3', glow: 'rgba(143,211,255,0.55)' },
  winQuips: ['Hop hop hooray!', 'Carrot champion!', 'Snuggly victory!'],
  killQuips: ['got bunny-booped into the void!', 'was munched like a carrot!', 'went down the rabbit hole!'],
  kinds: [
    { id: 'moon_bunny', name: 'Moon Bunny Statue', r: 11.5, place: ['landmark'], count: 1, sfx: 'boing', quips: ['Not the Moon Bunny!'] },
    { id: 'carrot_rocket', name: 'Carrot Rocket', r: 9.5, place: ['landmark'], count: 1, sfx: 'metal' },
    { id: 'bunny_castle', name: 'Bunny Castle', r: 7.5, place: ['city'], count: 8, sfx: 'thud' },
    { id: 'candy_tower', name: 'Candy Tower', r: 6.5, place: ['city'], count: 13, sfx: 'crunch' },
    { id: 'rainbow', name: 'Rainbow Arch', r: 7, place: ['park'], count: 4, sfx: 'boing' },
    { id: 'giant_teddy', name: 'Giant Teddy', r: 6.5, place: ['plaza', 'park'], count: 4, sfx: 'squeak' },
    { id: 'cottage', name: 'Pastel Cottage', r: 4.2, place: ['city'], count: 24, sfx: 'thud' },
    { id: 'windmill', name: 'Toy Windmill', r: 4.5, place: ['park', 'city'], count: 6, sfx: 'thud' },
    { id: 'carrot_house', name: 'Carrot House', r: 4, place: ['city'], count: 12, sfx: 'crunch' },
    { id: 'mushroom_house', name: 'Mushroom House', r: 4, place: ['city', 'park'], count: 12, sfx: 'boing' },
    { id: 'hot_air_balloon', name: 'Hot Air Balloon', r: 3.6, place: ['park', 'plaza'], count: 6, anim: 'bob', sfx: 'boing' },
    { id: 'toy_train', name: 'Toy Train', r: 2, place: ['road'], count: 22, sfx: 'honk', quips: ['Choo choo!'] },
    { id: 'pastel_tree', name: 'Cotton Candy Tree', r: 1.7, place: ['park', 'edge', 'plaza'], count: 50, sfx: 'crunch' },
    { id: 'giant_carrot', name: 'Giant Carrot', r: 1.6, place: ['park', 'plaza', 'any'], count: 30, sfx: 'crunch' },
    { id: 'big_bunny', name: 'Big Bunny', r: 1.5, place: ['park', 'plaza', 'any'], count: 25, anim: 'hop', sfx: 'boing', quips: ['Boing!'] },
    { id: 'rocking_horse', name: 'Rocking Horse', r: 1.4, place: ['park', 'plaza'], count: 15, anim: 'sway', sfx: 'thud' },
    { id: 'balloon', name: 'Balloon Bunch', r: 1.3, place: ['any'], count: 20, anim: 'bob', sfx: 'boing' },
    { id: 'teddy', name: 'Teddy Bear', r: 0.75, place: ['any', 'park'], count: 30, sfx: 'squeak' },
    { id: 'bunny', name: 'Baby Bunny', r: 0.7, place: ['any', 'park', 'edge'], count: 60, anim: 'hop', sfx: 'boing', quips: ['Eep!', 'Nom?'] },
    { id: 'toadstool', name: 'Toadstool', r: 0.7, place: ['park', 'edge'], count: 35, sfx: 'boing' },
    { id: 'blocks', name: 'Toy Blocks', r: 0.7, place: ['any', 'plaza'], count: 35, sfx: 'thud' },
    { id: 'lollipop', name: 'Lollipop', r: 0.65, place: ['edge', 'any'], count: 35, sfx: 'crunch' },
    { id: 'tulip', name: 'Tulip', r: 0.6, place: ['park', 'edge'], count: 40, sfx: 'crunch' },
    { id: 'mushroom', name: 'Mushroom', r: 0.35, place: ['any'], count: 50, sfx: 'boing' },
    { id: 'rubber_duck', name: 'Rubber Duck', r: 0.35, place: ['any'], count: 40, sfx: 'squeak' },
    { id: 'baby_bottle', name: 'Baby Bottle', r: 0.35, place: ['any'], count: 30, sfx: 'glass' },
    { id: 'carrot', name: 'Carrot', r: 0.3, place: ['any'], count: 80, sfx: 'crunch' },
    { id: 'daisy', name: 'Daisy', r: 0.3, place: ['any'], count: 60, sfx: 'crunch' },
    { id: 'pastel_egg', name: 'Pastel Egg', r: 0.3, place: ['any'], count: 60, sfx: 'crunch' },
  ],
};

const berlin: MapDef = {
  id: 'berlin',
  name: 'Berlin Meme City',
  subtitle: 'Döner · Spätis · U-Bahn · pure chaos',
  description: 'Graffiti, Spätis, Döner shops, U-Bahn, techno bunkers, Brandenburger Tor and the realest Kiez characters.',
  ui: { accent: '#ffd400', accent2: '#ff3b3b', glow: 'rgba(255,212,0,0.5)' },
  winQuips: ['Läuft bei dir!', 'Ehrenmann/Ehrenfrau!', 'Kiez-König!'],
  killQuips: ['wurde gefressen, Digga!', 'ist lost gegangen!', 'hat sich verlaufen... ins Loch!', 'muss jetzt Pfand sammeln!'],
  kinds: [
    { id: 'brandenburger_tor', name: 'Brandenburger Tor', r: 11, place: ['landmark'], count: 1, sfx: 'thud', quips: ['Das Tor?! Krass!'] },
    { id: 'fernsehturm', name: 'Fernsehturm', r: 9.5, place: ['landmark'], count: 1, sfx: 'metal', quips: ['Alex ist weg!'] },
    { id: 'plattenbau', name: 'Plattenbau', r: 7.5, place: ['city'], count: 9, sfx: 'thud' },
    { id: 'club_bunker', name: 'Techno Bunker', r: 7.5, place: ['city'], count: 4, sfx: 'thud', quips: ['Heute nicht.'] },
    { id: 'altbau', name: 'Altbau', r: 7, place: ['city'], count: 14, sfx: 'thud' },
    { id: 'ubahn_train', name: 'U-Bahn Zug', r: 4.6, place: ['road'], count: 5, sfx: 'metal', quips: ['Zurückbleiben bitte!'] },
    { id: 'doener_shop', name: 'Döner Imbiss', r: 4, place: ['city', 'plaza'], count: 14, sfx: 'splat', quips: ['Mit alles?'] },
    { id: 'spaeti', name: 'Späti', r: 3.8, place: ['city', 'plaza'], count: 14, sfx: 'glass', quips: ['24/7, Bruder'] },
    { id: 'graffiti_wall', name: 'Graffiti Wall', r: 3.5, place: ['park', 'plaza'], count: 10, sfx: 'thud' },
    { id: 'yellow_bus', name: 'Gelber Doppeldecker', r: 3.4, place: ['road'], count: 8, sfx: 'honk' },
    { id: 'ubahn_entrance', name: 'U-Bahn Eingang', r: 3.2, place: ['plaza', 'park'], count: 6, sfx: 'metal' },
    { id: 'curry_stand', name: 'Currywurst Bude', r: 3, place: ['plaza', 'park'], count: 6, sfx: 'splat' },
    { id: 'luxury_car', name: 'Bonzenkarre', r: 2, place: ['road'], count: 25, sfx: 'honk', quips: ['Leasing läuft noch!'] },
    { id: 'trabi', name: 'Rennpappe', r: 1.8, place: ['road'], count: 28, sfx: 'honk', quips: ['Ostalgie!'] },
    { id: 'linde', name: 'Linde', r: 1.7, place: ['park', 'edge'], count: 45, sfx: 'crunch' },
    { id: 'doner_spiess', name: 'Dönerspieß', r: 1.4, place: ['plaza', 'edge'], count: 12, anim: 'spin', sfx: 'splat', quips: ['Fleischberg!'] },
    { id: 'bench', name: 'Parkbank', r: 1.4, place: ['park', 'plaza'], count: 15, sfx: 'thud' },
    { id: 'litfass', name: 'Litfaßsäule', r: 1.3, place: ['edge', 'plaza'], count: 15, sfx: 'thud' },
    { id: 'phone_booth', name: 'Telefonzelle', r: 1.1, place: ['edge'], count: 10, sfx: 'glass' },
    { id: 'bike', name: 'Fahrrad', r: 0.9, place: ['edge'], count: 30, sfx: 'metal' },
    { id: 'jung', name: 'Jung mit Cap', r: 0.8, place: ['edge', 'plaza', 'park'], count: 30, anim: 'bob', sfx: 'squeak', quips: ['Vallah!', 'Bruder, was?!', 'Wallah krise!', 'Ich schwör!'] },
    { id: 'chaya', name: 'Chaya', r: 0.8, place: ['edge', 'plaza', 'park'], count: 30, anim: 'bob', sfx: 'squeak', quips: ['Lan, meine Nägel!', 'Ich schwör!', 'Digga nein!'] },
    { id: 'raver', name: 'Raver', r: 0.8, place: ['plaza', 'park', 'edge'], count: 25, anim: 'hop', sfx: 'squeak', quips: ['Untz untz untz', 'Noch 5 Minuten!'] },
    { id: 'tourist', name: 'Tourist', r: 0.8, place: ['plaza', 'edge'], count: 25, anim: 'bob', sfx: 'squeak', quips: ['Selfie!', 'Where is Checkpoint?'] },
    { id: 'escooter', name: 'E-Scooter', r: 0.75, place: ['edge', 'road'], count: 40, sfx: 'metal', quips: ['Liegt eh quer.'] },
    { id: 'bin', name: 'Orange Mülleimer', r: 0.6, place: ['edge'], count: 40, sfx: 'metal' },
    { id: 'ampel', name: 'Ampelmann', r: 0.6, place: ['edge'], count: 30, sfx: 'metal' },
    { id: 'doener', name: 'Döner', r: 0.35, place: ['any'], count: 60, sfx: 'splat', quips: ['Mit alles, scharf!'] },
    { id: 'currywurst', name: 'Currywurst', r: 0.35, place: ['any'], count: 40, sfx: 'splat' },
    { id: 'cone', name: 'Pylone', r: 0.35, place: ['any', 'road'], count: 40, sfx: 'squeak' },
    { id: 'pigeon', name: 'Taube', r: 0.3, place: ['any'], count: 40, anim: 'hop', sfx: 'squeak', quips: ['Gurr.'] },
    { id: 'designer_cap', name: 'Designer Cap', r: 0.3, place: ['any'], count: 30, sfx: 'squeak' },
    { id: 'mate', name: 'Mate Flasche', r: 0.25, place: ['any'], count: 40, sfx: 'glass' },
    { id: 'pfand', name: 'Pfandflasche', r: 0.25, place: ['any'], count: 80, sfx: 'glass', quips: ['Pfand gehört daneben!'] },
  ],
};

export const MAPS: Record<MapId, MapDef> = { pink, bunny, berlin };
export const MAP_IDS: MapId[] = ['pink', 'bunny', 'berlin'];
