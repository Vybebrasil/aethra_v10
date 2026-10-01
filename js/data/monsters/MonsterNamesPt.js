// MonsterNamesPt.js — nomes em português das criaturas e ataques do catálogo
// SRD (PocketDM). O MonsterCatalog aplica ao carregar data/monsters.json (e o
// MonsterCatalogAdapter ao normalizar registros novos); o nome original fica
// em sourceName (apelidos e buscas continuam funcionando).
// Anotações de regra de mesa nos ataques ("(Recharge 5-6)", "(1/Day)",
// "(Wolf or Hybrid Form Only)") não vão para o jogo.
(function initMonsterNamesPt(Aethra) {
    "use strict";

    const DRAGON_COLORS = Object.freeze({
        Black: "Negro", Blue: "Azul", Brass: "de Latão", Bronze: "de Bronze", Copper: "de Cobre",
        Gold: "Dourado", Green: "Verde", Red: "Vermelho", Silver: "Prateado", White: "Branco"
    });

    const CREATURES = {
        "Aboleth": "Abolete", "Acolyte": "Acólito", "Air Elemental": "Elemental do Ar", "Allosaurus": "Alossauro",
        "Androsphinx": "Androesfinge", "Animated Armor": "Armadura Animada", "Ankheg": "Ankheg", "Ankylosaurus": "Anquilossauro",
        "Ape": "Gorila", "Archmage": "Arquimago", "Assassin": "Assassino", "Awakened Shrub": "Arbusto Desperto",
        "Awakened Tree": "Árvore Desperta", "Axe Beak": "Bico-de-Machado", "Azer": "Azer", "Baboon": "Babuíno",
        "Badger": "Texugo", "Balor": "Balor", "Bandit": "Bandido", "Bandit Captain": "Capitão Bandido",
        "Barbed Devil": "Diabo Farpado", "Basilisk": "Basilisco", "Bat": "Morcego", "Bearded Devil": "Diabo Barbado",
        "Behir": "Behir", "Berserker": "Berserker", "Black Bear": "Urso Negro", "Black Pudding": "Pudim Negro",
        "Blink Dog": "Cão Teleportador", "Blood Hawk": "Falcão Sangrento", "Boar": "Javali", "Bone Devil": "Diabo Ósseo",
        "Brown Bear": "Urso Pardo", "Bugbear": "Bugbear", "Bulette": "Bulette", "Camel": "Camelo", "Cat": "Gato",
        "Centaur": "Centauro", "Chain Devil": "Diabo das Correntes", "Chimera": "Quimera", "Chuul": "Chuul",
        "Clay Golem": "Golem de Argila", "Cloaker": "Manto Sombrio", "Cloud Giant": "Gigante das Nuvens",
        "Cockatrice": "Cocatriz", "Commoner": "Plebeu", "Constrictor Snake": "Serpente Constritora", "Couatl": "Couatl",
        "Crab": "Caranguejo", "Crocodile": "Crocodilo", "Cult Fanatic": "Fanático do Culto", "Cultist": "Cultista",
        "Darkmantle": "Manto Negro", "Death Dog": "Cão da Morte", "Deep Gnome (Svirfneblin)": "Gnomo das Profundezas",
        "Deer": "Cervo", "Deva": "Deva", "Dire Wolf": "Lobo Atroz", "Djinni": "Djinn", "Doppelganger": "Metamorfo",
        "Draft Horse": "Cavalo de Tração", "Dragon Turtle": "Tartaruga-Dragão", "Dretch": "Dretch", "Drider": "Drider",
        "Drow": "Drow", "Druid": "Druida", "Dryad": "Dríade", "Duergar": "Duergar", "Dust Mephit": "Mefite de Poeira",
        "Eagle": "Águia", "Earth Elemental": "Elemental da Terra", "Efreeti": "Efreeti", "Elephant": "Elefante",
        "Elk": "Alce", "Erinyes": "Erínia", "Ettercap": "Ettercap", "Ettin": "Ettin", "Fire Elemental": "Elemental do Fogo",
        "Fire Giant": "Gigante do Fogo", "Flesh Golem": "Golem de Carne", "Flying Snake": "Serpente Voadora",
        "Flying Sword": "Espada Voadora", "Frog": "Sapo", "Frost Giant": "Gigante do Gelo", "Gargoyle": "Gárgula",
        "Gelatinous Cube": "Cubo Gelatinoso", "Ghast": "Lívido", "Ghost": "Fantasma", "Ghoul": "Carniçal",
        "Giant Ape": "Gorila Gigante", "Giant Badger": "Texugo Gigante", "Giant Bat": "Morcego Gigante",
        "Giant Boar": "Javali Gigante", "Giant Centipede": "Centopeia Gigante",
        "Giant Constrictor Snake": "Serpente Constritora Gigante", "Giant Crab": "Caranguejo Gigante",
        "Giant Crocodile": "Crocodilo Gigante", "Giant Eagle": "Águia Gigante", "Giant Elk": "Alce Gigante",
        "Giant Fire Beetle": "Besouro de Fogo Gigante", "Giant Frog": "Sapo Gigante", "Giant Goat": "Bode Gigante",
        "Giant Hyena": "Hiena Gigante", "Giant Lizard": "Lagarto Gigante", "Giant Octopus": "Polvo Gigante",
        "Giant Owl": "Coruja Gigante", "Giant Poisonous Snake": "Serpente Venenosa Gigante", "Giant Rat": "Rato Gigante",
        "Giant Scorpion": "Escorpião Gigante", "Giant Sea Horse": "Cavalo-Marinho Gigante", "Giant Shark": "Tubarão Gigante",
        "Giant Spider": "Aranha Gigante", "Giant Toad": "Sapo-Boi Gigante", "Giant Vulture": "Abutre Gigante",
        "Giant Wasp": "Vespa Gigante", "Giant Weasel": "Doninha Gigante", "Giant Wolf Spider": "Aranha-Lobo Gigante",
        "Gibbering Mouther": "Boca Tagarela", "Glabrezu": "Glabrezu", "Gladiator": "Gladiador", "Gnoll": "Gnoll",
        "Goat": "Bode", "Goblin": "Goblin", "Goblin Boss": "Chefe Goblin", "Gorgon": "Górgona", "Gray Ooze": "Gosma Cinzenta",
        "Green Hag": "Bruxa Verde", "Grick": "Grick", "Griffon": "Grifo", "Grimlock": "Grimlock", "Guard": "Guarda",
        "Guardian Naga": "Naga Guardiã", "Gynosphinx": "Ginoesfinge", "Half-Red Dragon Veteran": "Veterano Meio-Dragão",
        "Harpy": "Harpia", "Hawk": "Falcão", "Hell Hound": "Cão Infernal", "Hezrou": "Hezrou", "Hill Giant": "Gigante das Colinas",
        "Hippogriff": "Hipogrifo", "Hobgoblin": "Hobgoblin", "Hobgoblin Captain": "Capitão Hobgoblin",
        "Homunculus": "Homúnculo", "Horned Devil": "Diabo Chifrudo", "Hunter Shark": "Tubarão Caçador", "Hydra": "Hidra",
        "Hyena": "Hiena", "Ice Devil": "Diabo do Gelo", "Ice Mephit": "Mefite de Gelo", "Imp": "Diabrete",
        "Incubus": "Íncubo", "Invisible Stalker": "Perseguidor Invisível", "Iron Golem": "Golem de Ferro",
        "Jackal": "Chacal", "Killer Whale": "Orca", "Knight": "Cavaleiro", "Kobold": "Kobold", "Kraken": "Kraken",
        "Lamia": "Lâmia", "Lemure": "Lêmure", "Lich": "Lich", "Lion": "Leão", "Lizard": "Lagarto",
        "Lizardfolk": "Homem-Lagarto", "Mage": "Mago", "Magma Mephit": "Mefite de Magma", "Magmin": "Magmin",
        "Mammoth": "Mamute", "Manticore": "Mantícora", "Marilith": "Marilith", "Mastiff": "Mastim", "Medusa": "Medusa",
        "Merfolk": "Tritão", "Merrow": "Merrow", "Mimic": "Mímico", "Minotaur": "Minotauro",
        "Minotaur Skeleton": "Esqueleto de Minotauro", "Mule": "Mula", "Mummy": "Múmia", "Mummy Lord": "Senhor das Múmias",
        "Nalfeshnee": "Nalfeshnee", "Night Hag": "Bruxa Noturna", "Nightmare": "Pesadelo", "Noble": "Nobre",
        "Ochre Jelly": "Geleia Ocre", "Octopus": "Polvo", "Ogre": "Ogro", "Ogre Zombie": "Zumbi Ogro", "Oni": "Oni",
        "Orc": "Orc", "Otyugh": "Otyugh", "Owl": "Coruja", "Owlbear": "Urso-Coruja", "Panther": "Pantera",
        "Pegasus": "Pégaso", "Phase Spider": "Aranha Fásica", "Pit Fiend": "Diabo do Fosso", "Planetar": "Planetar",
        "Plesiosaurus": "Plesiossauro", "Poisonous Snake": "Serpente Venenosa", "Polar Bear": "Urso Polar",
        "Pony": "Pônei", "Priest": "Sacerdote", "Pseudodragon": "Pseudodragão", "Pteranodon": "Pteranodonte",
        "Purple Worm": "Verme Púrpura", "Quasit": "Quasit", "Quipper": "Piranha", "Rakshasa": "Rakshasa", "Rat": "Rato",
        "Raven": "Corvo", "Reef Shark": "Tubarão-de-Recife", "Remorhaz": "Remorhaz", "Rhinoceros": "Rinoceronte",
        "Riding Horse": "Cavalo de Montaria", "Roc": "Roca", "Roper": "Enlaçador", "Rug of Smothering": "Tapete Sufocante",
        "Rust Monster": "Monstro da Ferrugem", "Saber-Toothed Tiger": "Tigre-Dentes-de-Sabre", "Sahuagin": "Sahuagin",
        "Salamander": "Salamandra", "Satyr": "Sátiro", "Scorpion": "Escorpião", "Scout": "Rastreador",
        "Sea Hag": "Bruxa do Mar", "Sea Horse": "Cavalo-Marinho", "Shadow": "Sombra", "Shambling Mound": "Montão Rastejante",
        "Shield Guardian": "Guardião Escudo", "Shrieker": "Cogumelo Gritador", "Skeleton": "Esqueleto", "Solar": "Solar",
        "Specter": "Espectro", "Spider": "Aranha", "Spirit Naga": "Naga Espiritual", "Sprite": "Fada", "Spy": "Espião",
        "Steam Mephit": "Mefite de Vapor", "Stirge": "Estirge", "Stone Giant": "Gigante de Pedra",
        "Stone Golem": "Golem de Pedra", "Storm Giant": "Gigante da Tempestade", "Succubus": "Súcubo",
        "Swarm of Bats": "Enxame de Morcegos", "Swarm of Beetles": "Enxame de Besouros",
        "Swarm of Centipedes": "Enxame de Centopeias", "Swarm of Insects": "Enxame de Insetos",
        "Swarm of Poisonous Snakes": "Enxame de Serpentes Venenosas", "Swarm of Quippers": "Enxame de Piranhas",
        "Swarm of Rats": "Enxame de Ratos", "Swarm of Ravens": "Enxame de Corvos", "Swarm of Spiders": "Enxame de Aranhas",
        "Swarm of Wasps": "Enxame de Vespas", "Tarrasque": "Tarrasque", "Thug": "Brutamontes", "Tiger": "Tigre",
        "Treant": "Ente", "Tribal Warrior": "Guerreiro Tribal", "Triceratops": "Tricerátops", "Troll": "Troll",
        "Tyrannosaurus Rex": "Tiranossauro Rex", "Unicorn": "Unicórnio", "Vampire": "Vampiro",
        "Vampire Spawn": "Cria Vampírica", "Veteran": "Veterano", "Violet Fungus": "Fungo Violeta", "Vrock": "Vrock",
        "Vulture": "Abutre", "Warhorse": "Cavalo de Guerra", "Warhorse Skeleton": "Esqueleto de Cavalo de Guerra",
        "Water Elemental": "Elemental da Água", "Weasel": "Doninha", "Werebear": "Homem-Urso", "Wereboar": "Homem-Javali",
        "Wererat": "Homem-Rato", "Weretiger": "Homem-Tigre", "Werewolf": "Lobisomem", "Wight": "Inumano",
        "Will-o'-Wisp": "Fogo-Fátuo", "Winter Wolf": "Lobo Invernal", "Wolf": "Lobo", "Worg": "Worg",
        "Wraith": "Espectro Negro", "Wyvern": "Serpe", "Xorn": "Xorn", "Zombie": "Zumbi"
    };

    // Dragões: "Adult Red Dragon" → "Dragão Vermelho Adulto", "Red Dragon Wyrmling" → "Filhote de Dragão Vermelho".
    Object.entries(DRAGON_COLORS).forEach(([color, pt]) => {
        CREATURES[`Adult ${color} Dragon`] = `Dragão ${pt} Adulto`;
        CREATURES[`Ancient ${color} Dragon`] = `Dragão ${pt} Ancião`;
        CREATURES[`Young ${color} Dragon`] = `Dragão ${pt} Jovem`;
        CREATURES[`${color} Dragon Wyrmling`] = `Filhote de Dragão ${pt}`;
    });

    const ABILITIES = {
        "Acid Breath": "Sopro Ácido", "Acid Spray": "Jato Ácido", "Animate Trees": "Animar Árvores", "Antennae": "Antenas",
        "Arcane Burst": "Explosão Arcana", "Attach": "Agarrar", "Baleful Command": "Comando Funesto",
        "Battleaxe": "Machado de Batalha", "Beak": "Bicada", "Beaks": "Bicadas", "Beard": "Barba", "Bite": "Mordida",
        "Bites": "Mordidas", "Bladed Arm": "Braço Afiado", "Blinding Breath": "Sopro Cegante",
        "Blinding Spittle": "Cuspe Cegante", "Bone Cudgel": "Porrete de Osso", "Boulder": "Pedregulho",
        "Boulder Toss": "Arremesso de Pedregulho", "Burn": "Queimadura", "Cacophony": "Cacofonia", "Chain": "Corrente",
        "Channel Negative Energy": "Energia Negativa", "Charged Tendril": "Tentáculo Carregado", "Charm": "Encanto",
        "Claw": "Garra", "Claws": "Garras", "Club": "Clava", "Cold Breath": "Sopro Gélido",
        "Conjure Infernal Chain": "Corrente Infernal", "Constrict": "Constrição", "Consume Memories": "Devorar Memórias",
        "Corrupting Touch": "Toque Corruptor", "Create Specter": "Criar Espectro", "Create Whirlwind": "Criar Redemoinho",
        "Crush": "Esmagamento", "Cursed Touch": "Toque Amaldiçoado", "Dagger": "Adaga", "Darkness Aura": "Aura de Trevas",
        "Deadly Leap": "Salto Mortal", "Death Glare": "Olhar Mortal", "Destroy Metal": "Destruir Metal",
        "Devilish Claw": "Garra Diabólica", "Dissolving Pseudopod": "Pseudópode Dissolvente",
        "Dominate Mind": "Dominar Mente", "Draining Kiss": "Beijo Drenante", "Draining Swipe": "Golpe Drenante",
        "Dreadful Glare": "Olhar Aterrador", "Eldritch Burst": "Explosão Sobrenatural", "Enchanting Bow": "Arco Encantador",
        "Engulf": "Engolfar", "Enlarge": "Agigantar", "Entangling Rope": "Corda Enredante", "Ethereal Stride": "Passo Etéreo",
        "Fetid Cloud": "Nuvem Fétida", "Fiendish Touch": "Toque Demoníaco", "Fiery Bolt": "Raio Flamejante",
        "Fiery Mace": "Maça Flamejante", "Fire Breath": "Sopro de Fogo", "Fist": "Soco", "Flame Spear": "Lança Flamejante",
        "Flame Sword": "Espada Flamejante", "Flame Whip": "Chicote Flamejante", "Fling": "Arremesso",
        "Flying Sword": "Espada Voadora", "Force Bolt": "Raio de Força", "Foreleg": "Pata Dianteira",
        "Frost Axe": "Machado Gélido", "Frost Breath": "Sopro Congelante", "Gore": "Chifrada", "Gouge": "Perfuração",
        "Grave Strike": "Golpe Sepulcral", "Great Bow": "Arco Grande", "Greataxe": "Machado Grande",
        "Greatclub": "Clava Grande", "Greatsword": "Espada Grande", "Hail of Bark": "Chuva de Cascas",
        "Hammer Throw": "Arremesso de Martelo", "Hand Crossbow": "Besta de Mão", "Handaxe": "Machadinha",
        "Harpoon": "Arpão", "Heart Sight": "Visão do Coração", "Heated Blade": "Lâmina Incandescente",
        "Heavy Club": "Clava Pesada", "Heavy Crossbow": "Besta Pesada", "Holy Burst": "Explosão Sagrada",
        "Holy Mace": "Maça Sagrada", "Hooves": "Cascos", "Horrific Visage": "Visão Horrenda", "Hurl Flame": "Lançar Chamas",
        "Ice Spear": "Lança de Gelo", "Infernal Glaive": "Glaive Infernal", "Infernal Sting": "Ferrão Infernal",
        "Infernal Tail": "Cauda Infernal", "Ink Cloud": "Nuvem de Tinta", "Invisibility": "Invisibilidade",
        "Javelin": "Azagaia", "Life Drain": "Dreno de Vida", "Light Crossbow": "Besta Leve",
        "Lightning Blade": "Lâmina Relâmpago", "Lightning Breath": "Sopro Elétrico",
        "Lightning Storm": "Tempestade de Raios", "Lightning Strike": "Relâmpago", "Longbow": "Arco Longo",
        "Longsword": "Espada Longa", "Luring Song": "Canção Sedutora", "Mace": "Maça", "Mockery": "Zombaria",
        "Morningstar": "Maça-Estrela", "Multiattack": "Ataque Múltiplo", "Necrotic Bow": "Arco Necrótico",
        "Necrotic Ray": "Raio Necrótico", "Necrotic Sword": "Espada Necrótica", "Needle Sword": "Espada-Agulha",
        "Nightmare Ray": "Raio do Pesadelo", "Pact Blade": "Lâmina do Pacto", "Paralyzing Breath": "Sopro Paralisante",
        "Paralyzing Tentacles": "Tentáculos Paralisantes", "Paralyzing Touch": "Toque Paralisante",
        "Petrifying Bite": "Mordida Petrificante", "Petrifying Breath": "Sopro Petrificante", "Pike": "Pique",
        "Pincer": "Pinça", "Pistol": "Pistola", "Poison Breath": "Sopro Venenoso", "Poison Burst": "Explosão Venenosa",
        "Poison Ray": "Raio Venenoso", "Poisoned Dart": "Dardo Envenenado", "Poisonous Spittle": "Cuspe Venenoso",
        "Possession": "Possessão", "Proboscis": "Probóscide", "Pseudopod": "Pseudópode", "Pummel": "Pancadaria",
        "Radiant Flame": "Chama Radiante", "Radiant Horn": "Chifre Radiante", "Radiant Sword": "Espada Radiante",
        "Rake": "Arranhão", "Ram": "Investida", "Rapier": "Florete", "Reel": "Puxão", "Rend": "Dilacerar",
        "Repulsion Breath": "Sopro Repulsor", "Restless Touch": "Toque Inquieto", "Ritual Sickle": "Foice Ritual",
        "Roar": "Rugido", "Rock": "Rocha", "Rock Launch": "Lançar Rocha", "Rotting Fist": "Punho Pútrido",
        "Rotting Touch": "Toque Pútrido", "Scare": "Susto", "Scimitar": "Cimitarra", "Scratch": "Arranhão",
        "Searing Fork": "Forcado Ardente", "Shape-Shift": "Metamorfose", "Shield Bash": "Golpe de Escudo",
        "Shock": "Choque", "Shortbow": "Arco Curto", "Shortsword": "Espada Curta", "Shred": "Retalhar", "Slam": "Pancada",
        "Slaying Bow": "Arco Assassino", "Sleep Breath": "Sopro do Sono", "Sling": "Funda",
        "Slowing Breath": "Sopro Lentificante", "Smother": "Sufocar", "Snake Hair": "Cabelo de Serpentes",
        "Spear": "Lança", "Spiked Shield": "Escudo Cravejado", "Spores": "Esporos", "Steam Breath": "Sopro de Vapor",
        "Sting": "Ferroada", "Stone Club": "Clava de Pedra", "Storm Blade": "Lâmina da Tempestade",
        "Storm Bolt": "Raio da Tempestade", "Storm Sword": "Espada da Tempestade", "Stunning Screech": "Guincho Atordoante",
        "Swallow": "Engolir", "Tail": "Cauda", "Tail Spike": "Espinho da Cauda", "Tail Stinger": "Ferrão da Cauda",
        "Talons": "Garras", "Teleport": "Teleporte", "Tentacle": "Tentáculo", "Tentacle Slam": "Golpe de Tentáculo",
        "Tentacles": "Tentáculos", "Thorn Burst": "Explosão de Espinhos", "Thunderbolt": "Trovão",
        "Thundercloud": "Nuvem de Trovão", "Thunderous Bellow": "Bramido Trovejante", "Thunderous Mace": "Maça Trovejante",
        "Thunderous Slam": "Pancada Trovejante", "Touch": "Toque", "Trash Lob": "Arremesso de Lixo",
        "Tree Club": "Clava de Árvore", "Tusk": "Presa", "Unsettling Visage": "Visão Perturbadora",
        "Verdant Wisp": "Lume Verdejante", "Vile Slime": "Gosma Vil", "Vine Lash": "Açoite de Vinha",
        "Vine Staff": "Cajado de Vinha", "Vortex": "Vórtice", "War Pick": "Picareta de Guerra",
        "Warhammer": "Martelo de Guerra", "Weakening Breath": "Sopro Enfraquecedor", "Web": "Teia",
        "Web Strand": "Fio de Teia", "Whelm": "Submergir", "Whirlwind": "Redemoinho", "Wind Swipe": "Golpe de Vento",
        "Withering Sword": "Espada Definhante", "Withering Touch": "Toque Definhante"
    };

    // "Fire Breath (Recharge 5-6)" → "Fire Breath": a anotação é regra de mesa.
    function abilityBase(name) {
        return String(name || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
    }

    Aethra.MonsterNamesPt = {
        creatures: CREATURES,
        abilities: ABILITIES,
        abilityBase,
        creature(name) {
            return CREATURES[name] || null;
        },
        ability(name) {
            return ABILITIES[abilityBase(name)] || null;
        }
    };
})(window.Aethra = window.Aethra || {});
