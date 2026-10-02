// HuntSceneCatalog.js — GERADO por scripts/build_hunt_scene.py: folhas de sprite, fundos e
// efeitos da cena de caçada (créditos em assets/scene/CREDITS.md). Só dados.
(function (Aethra) {
    "use strict";
    Aethra.HuntSceneCatalog = {
        "actors": {
            "vanguard": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/heroes/vanguard/idle.png",
                        "fw": 180,
                        "fh": 180,
                        "frames": 11,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/heroes/vanguard/run.png",
                        "fw": 180,
                        "fh": 180,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/heroes/vanguard/attack.png",
                        "fw": 180,
                        "fh": 180,
                        "frames": 7,
                        "fps": 14,
                        "loop": false
                    },
                    "attack2": {
                        "src": "assets/scene/heroes/vanguard/attack2.png",
                        "fw": 180,
                        "fh": 180,
                        "frames": 7,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/heroes/vanguard/hurt.png",
                        "fw": 180,
                        "fh": 180,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/heroes/vanguard/death.png",
                        "fw": 180,
                        "fh": 180,
                        "frames": 11,
                        "fps": 10,
                        "loop": false
                    }
                },
                "footY": 114,
                "centerX": 96,
                "height": 51,
                "width": 47
            },
            "berserker": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/heroes/berserker/idle.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 8,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/heroes/berserker/run.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/heroes/berserker/attack.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 6,
                        "fps": 14,
                        "loop": false
                    },
                    "attack2": {
                        "src": "assets/scene/heroes/berserker/attack2.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 6,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/heroes/berserker/hurt.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/heroes/berserker/death.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 6,
                        "fps": 9,
                        "loop": false
                    }
                },
                "footY": 122,
                "centerX": 94,
                "height": 52,
                "width": 37
            },
            "templar": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/heroes/templar/idle.png",
                        "fw": 162,
                        "fh": 162,
                        "frames": 10,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/heroes/templar/run.png",
                        "fw": 162,
                        "fh": 162,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/heroes/templar/attack.png",
                        "fw": 162,
                        "fh": 162,
                        "frames": 7,
                        "fps": 14,
                        "loop": false
                    },
                    "attack2": {
                        "src": "assets/scene/heroes/templar/attack2.png",
                        "fw": 162,
                        "fh": 162,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/heroes/templar/hurt.png",
                        "fw": 162,
                        "fh": 162,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/heroes/templar/death.png",
                        "fw": 162,
                        "fh": 162,
                        "frames": 7,
                        "fps": 9,
                        "loop": false
                    }
                },
                "footY": 101,
                "centerX": 86,
                "height": 45,
                "width": 40
            },
            "ranger": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/heroes/ranger/idle.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 10,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/heroes/ranger/run.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/heroes/ranger/attack.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 6,
                        "fps": 12,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/heroes/ranger/hurt.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/heroes/ranger/death.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 10,
                        "fps": 11,
                        "loop": false
                    }
                },
                "footY": 67,
                "centerX": 51,
                "height": 36,
                "width": 32
            },
            "nightblade": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/heroes/nightblade/idle.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 4,
                        "fps": 7,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/heroes/nightblade/run.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/heroes/nightblade/attack.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "attack2": {
                        "src": "assets/scene/heroes/nightblade/attack2.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/heroes/nightblade/hurt.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/heroes/nightblade/death.png",
                        "fw": 200,
                        "fh": 200,
                        "frames": 7,
                        "fps": 9,
                        "loop": false
                    }
                },
                "footY": 128,
                "centerX": 98,
                "height": 56,
                "width": 33
            },
            "arcanist": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/heroes/arcanist/idle.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/heroes/arcanist/run.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/heroes/arcanist/attack.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/heroes/arcanist/hurt.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/heroes/arcanist/death.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 5,
                        "fps": 8,
                        "loop": false
                    }
                },
                "footY": 102,
                "centerX": 72,
                "height": 58,
                "width": 35
            },
            "goblin": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/goblin/idle.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/goblin/run.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/goblin/attack.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/goblin/hurt.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/goblin/death.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": false
                    }
                },
                "footY": 101,
                "centerX": 74,
                "height": 36,
                "width": 33
            },
            "skeleton": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/skeleton/idle.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/skeleton/run.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/skeleton/attack.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/skeleton/hurt.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/skeleton/death.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": false
                    }
                },
                "footY": 101,
                "centerX": 82,
                "height": 51,
                "width": 45
            },
            "mushroom": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/mushroom/idle.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/mushroom/run.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/mushroom/attack.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/mushroom/hurt.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/mushroom/death.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": false
                    }
                },
                "footY": 101,
                "centerX": 76,
                "height": 37,
                "width": 23
            },
            "eye": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/eye/idle.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/eye/run.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 14,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/eye/attack.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/eye/hurt.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/eye/death.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 8,
                        "loop": false
                    }
                },
                "footY": 93,
                "centerX": 77,
                "height": 33,
                "width": 42
            },
            "rat": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/rat/idle.png",
                        "fw": 70,
                        "fh": 70,
                        "frames": 10,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/rat/run.png",
                        "fw": 70,
                        "fh": 70,
                        "frames": 8,
                        "fps": 14,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/rat/attack.png",
                        "fw": 70,
                        "fh": 70,
                        "frames": 12,
                        "fps": 20,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/rat/hurt.png",
                        "fw": 70,
                        "fh": 70,
                        "frames": 3,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/rat/death.png",
                        "fw": 70,
                        "fh": 70,
                        "frames": 6,
                        "fps": 10,
                        "loop": false
                    }
                },
                "footY": 45,
                "centerX": 35,
                "height": 20,
                "width": 40
            },
            "bat": {
                "facing": "front",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/bat/idle.png",
                        "fw": 87,
                        "fh": 87,
                        "frames": 11,
                        "fps": 14,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/bat/run.png",
                        "fw": 87,
                        "fh": 87,
                        "frames": 11,
                        "fps": 16,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/bat/attack.png",
                        "fw": 87,
                        "fh": 87,
                        "frames": 11,
                        "fps": 18,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/bat/hurt.png",
                        "fw": 87,
                        "fh": 87,
                        "frames": 3,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/bat/death.png",
                        "fw": 87,
                        "fh": 87,
                        "frames": 4,
                        "fps": 8,
                        "loop": false
                    }
                },
                "footY": 71,
                "centerX": 48,
                "height": 55,
                "width": 67
            },
            "slime": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/slime/idle.png",
                        "fw": 156,
                        "fh": 156,
                        "frames": 14,
                        "fps": 12,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/slime/run.png",
                        "fw": 156,
                        "fh": 156,
                        "frames": 6,
                        "fps": 10,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/slime/attack.png",
                        "fw": 156,
                        "fh": 156,
                        "frames": 19,
                        "fps": 24,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/slime/hurt.png",
                        "fw": 156,
                        "fh": 156,
                        "frames": 3,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/slime/death.png",
                        "fw": 156,
                        "fh": 156,
                        "frames": 11,
                        "fps": 14,
                        "loop": false
                    }
                },
                "footY": 87,
                "centerX": 78,
                "height": 20,
                "width": 44
            },
            "mimic": {
                "facing": "front",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/mimic/idle.png",
                        "fw": 146,
                        "fh": 146,
                        "frames": 9,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/mimic/run.png",
                        "fw": 146,
                        "fh": 146,
                        "frames": 6,
                        "fps": 10,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/mimic/attack.png",
                        "fw": 146,
                        "fh": 146,
                        "frames": 14,
                        "fps": 20,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/mimic/hurt.png",
                        "fw": 146,
                        "fh": 146,
                        "frames": 3,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/mimic/death.png",
                        "fw": 146,
                        "fh": 146,
                        "frames": 6,
                        "fps": 9,
                        "loop": false
                    }
                },
                "footY": 83,
                "centerX": 78,
                "height": 30,
                "width": 43
            },
            "bandit": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/bandit/idle.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/bandit/run.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/bandit/attack.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/bandit/hurt.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/bandit/death.png",
                        "fw": 150,
                        "fh": 150,
                        "frames": 6,
                        "fps": 9,
                        "loop": false
                    }
                },
                "footY": 95,
                "centerX": 75,
                "height": 41,
                "width": 26
            },
            "brute": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/brute/idle.png",
                        "fw": 184,
                        "fh": 137,
                        "frames": 6,
                        "fps": 9,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/brute/run.png",
                        "fw": 184,
                        "fh": 137,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/brute/attack.png",
                        "fw": 184,
                        "fh": 137,
                        "frames": 4,
                        "fps": 10,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/brute/hurt.png",
                        "fw": 184,
                        "fh": 137,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/brute/death.png",
                        "fw": 184,
                        "fh": 137,
                        "frames": 9,
                        "fps": 12,
                        "loop": false
                    }
                },
                "footY": 125,
                "centerX": 92,
                "height": 81,
                "width": 45
            },
            "warlock": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/warlock/idle.png",
                        "fw": 250,
                        "fh": 250,
                        "frames": 8,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/warlock/run.png",
                        "fw": 250,
                        "fh": 250,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/warlock/attack.png",
                        "fw": 250,
                        "fh": 250,
                        "frames": 8,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/warlock/hurt.png",
                        "fw": 250,
                        "fh": 250,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/warlock/death.png",
                        "fw": 250,
                        "fh": 250,
                        "frames": 7,
                        "fps": 9,
                        "loop": false
                    }
                },
                "footY": 167,
                "centerX": 136,
                "height": 104,
                "width": 57
            },
            "king": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/king/idle.png",
                        "fw": 155,
                        "fh": 155,
                        "frames": 6,
                        "fps": 9,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/king/run.png",
                        "fw": 155,
                        "fh": 155,
                        "frames": 8,
                        "fps": 12,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/king/attack.png",
                        "fw": 155,
                        "fh": 155,
                        "frames": 6,
                        "fps": 12,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/king/hurt.png",
                        "fw": 155,
                        "fh": 155,
                        "frames": 4,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/king/death.png",
                        "fw": 155,
                        "fh": 155,
                        "frames": 11,
                        "fps": 12,
                        "loop": false
                    }
                },
                "footY": 116,
                "centerX": 66,
                "height": 81,
                "width": 37
            },
            "knight": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/knight/idle.png",
                        "fw": 135,
                        "fh": 135,
                        "frames": 10,
                        "fps": 10,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/knight/run.png",
                        "fw": 135,
                        "fh": 135,
                        "frames": 6,
                        "fps": 10,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/knight/attack.png",
                        "fw": 135,
                        "fh": 135,
                        "frames": 4,
                        "fps": 10,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/knight/hurt.png",
                        "fw": 135,
                        "fh": 135,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    },
                    "death": {
                        "src": "assets/scene/monsters/knight/death.png",
                        "fw": 135,
                        "fh": 135,
                        "frames": 9,
                        "fps": 12,
                        "loop": false
                    }
                },
                "footY": 86,
                "centerX": 67,
                "height": 38,
                "width": 26
            },
            "wolf": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/wolf/idle.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 10,
                        "fps": 9,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/wolf/run.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 8,
                        "fps": 14,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/wolf/attack.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    }
                },
                "footY": 62,
                "centerX": 50,
                "height": 24,
                "width": 33
            },
            "bigdog": {
                "facing": "right",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/bigdog/idle.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 10,
                        "fps": 9,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/bigdog/run.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 8,
                        "fps": 14,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/bigdog/attack.png",
                        "fw": 100,
                        "fh": 100,
                        "frames": 3,
                        "fps": 10,
                        "loop": false
                    }
                },
                "footY": 65,
                "centerX": 50,
                "height": 29,
                "width": 43
            },
            "boar": {
                "facing": "left",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/boar/idle.png",
                        "fw": 48,
                        "fh": 32,
                        "frames": 4,
                        "fps": 8,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/boar/run.png",
                        "fw": 48,
                        "fh": 32,
                        "frames": 6,
                        "fps": 12,
                        "loop": true
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/boar/hurt.png",
                        "fw": 48,
                        "fh": 32,
                        "frames": 4,
                        "fps": 10,
                        "loop": false
                    }
                },
                "footY": 32,
                "centerX": 21,
                "height": 27,
                "width": 42
            },
            "bee": {
                "facing": "left",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/bee/idle.png",
                        "fw": 64,
                        "fh": 64,
                        "frames": 4,
                        "fps": 12,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/bee/run.png",
                        "fw": 64,
                        "fh": 64,
                        "frames": 4,
                        "fps": 14,
                        "loop": true
                    },
                    "attack": {
                        "src": "assets/scene/monsters/bee/attack.png",
                        "fw": 64,
                        "fh": 64,
                        "frames": 4,
                        "fps": 14,
                        "loop": false
                    },
                    "hurt": {
                        "src": "assets/scene/monsters/bee/hurt.png",
                        "fw": 64,
                        "fh": 64,
                        "frames": 4,
                        "fps": 12,
                        "loop": false
                    }
                },
                "footY": 45,
                "centerX": 38,
                "height": 40,
                "width": 37
            },
            "bear": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/bear/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/bear/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "spider_red": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/spider_red/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/spider_red/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "spider_yellow": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/spider_yellow/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/spider_yellow/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "skull": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/skull/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/skull/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "spirit": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/spirit/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/spirit/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 12
            },
            "cyclope": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/cyclope/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/cyclope/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "cyclope2": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/cyclope2/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/cyclope2/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "dragon": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/dragon/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/dragon/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 14
            },
            "dragon_yellow": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/dragon_yellow/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/dragon_yellow/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 14
            },
            "mole": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/mole/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/mole/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "lizard": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/lizard/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/lizard/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 14,
                "width": 14
            },
            "beast": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/beast/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/beast/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "beast2": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/beast2/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/beast2/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "larva": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/larva/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/larva/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "snake": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/snake/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/snake/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 15
            },
            "owl": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/owl/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/owl/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "flam": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/flam/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/flam/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "reptile": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/reptile/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/reptile/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            },
            "trex": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/trex/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/trex/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 16,
                "width": 16
            },
            "mollusc": {
                "facing": "left",
                "style": "ninja",
                "anims": {
                    "idle": {
                        "src": "assets/scene/monsters/mollusc/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 4,
                        "loop": true
                    },
                    "run": {
                        "src": "assets/scene/monsters/mollusc/walk.png",
                        "fw": 16,
                        "fh": 16,
                        "frames": 4,
                        "fps": 9,
                        "loop": true
                    }
                },
                "footY": 16,
                "centerX": 8,
                "height": 15,
                "width": 16
            }
        },
        "backgrounds": {
            "forest": {
                "ground": "#1c2a12",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/forest/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.08,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/forest/lights.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.15,
                        "glow": true
                    },
                    {
                        "src": "assets/scene/backgrounds/forest/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/forest/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "autumn": {
                "ground": "#20140c",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/autumn/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.08,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/autumn/lights.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.15,
                        "glow": true
                    },
                    {
                        "src": "assets/scene/backgrounds/autumn/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/autumn/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "sunset": {
                "ground": "#140a0a",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/sunset/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.1,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/sunset/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/sunset/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "crypt": {
                "ground": "#0b0f1a",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/crypt/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.08,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/crypt/lights.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.15,
                        "glow": true
                    },
                    {
                        "src": "assets/scene/backgrounds/crypt/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/crypt/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "hollow": {
                "ground": "#120c18",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/hollow/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.08,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/hollow/lights.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.15,
                        "glow": true
                    },
                    {
                        "src": "assets/scene/backgrounds/hollow/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/hollow/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "swamp": {
                "ground": "#0e1712",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/swamp/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.08,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/swamp/lights.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.15,
                        "glow": true
                    },
                    {
                        "src": "assets/scene/backgrounds/swamp/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/swamp/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "hills": {
                "ground": "#151313",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/hills/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.1,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/hills/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/hills/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "frost": {
                "ground": "#1a2430",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/frost/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.08,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/frost/lights.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.15,
                        "glow": true
                    },
                    {
                        "src": "assets/scene/backgrounds/frost/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/frost/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            },
            "ember": {
                "ground": "#180808",
                "layers": [
                    {
                        "src": "assets/scene/backgrounds/ember/back.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.1,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/ember/middle.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.3,
                        "glow": false
                    },
                    {
                        "src": "assets/scene/backgrounds/ember/front.png",
                        "w": 272,
                        "h": 160,
                        "speed": 0.6,
                        "glow": false
                    }
                ]
            }
        },
        "fx": {
            "slash": {
                "src": "assets/scene/fx/slash.png",
                "fw": 26,
                "fh": 32,
                "frames": 5,
                "fps": 18
            },
            "slash_big": {
                "src": "assets/scene/fx/slash_big.png",
                "fw": 66,
                "fh": 50,
                "frames": 6,
                "fps": 18
            },
            "slash_arc": {
                "src": "assets/scene/fx/slash_arc.png",
                "fw": 38,
                "fh": 34,
                "frames": 6,
                "fps": 18
            },
            "claw": {
                "src": "assets/scene/fx/claw.png",
                "fw": 30,
                "fh": 30,
                "frames": 9,
                "fps": 18
            },
            "spark": {
                "src": "assets/scene/fx/spark.png",
                "fw": 30,
                "fh": 35,
                "frames": 9,
                "fps": 16
            },
            "heal": {
                "src": "assets/scene/fx/heal.png",
                "fw": 53,
                "fh": 35,
                "frames": 8,
                "fps": 14
            },
            "aura": {
                "src": "assets/scene/fx/aura.png",
                "fw": 25,
                "fh": 24,
                "frames": 5,
                "fps": 12
            },
            "holy": {
                "src": "assets/scene/fx/holy.png",
                "fw": 32,
                "fh": 32,
                "frames": 4,
                "fps": 14
            },
            "smoke": {
                "src": "assets/scene/fx/smoke.png",
                "fw": 32,
                "fh": 32,
                "frames": 6,
                "fps": 14
            },
            "explosion": {
                "src": "assets/scene/fx/explosion.png",
                "fw": 40,
                "fh": 40,
                "frames": 9,
                "fps": 16
            },
            "flame": {
                "src": "assets/scene/fx/flame.png",
                "fw": 25,
                "fh": 30,
                "frames": 8,
                "fps": 14
            },
            "fireball": {
                "src": "assets/scene/fx/fireball.png",
                "fw": 16,
                "fh": 16,
                "frames": 4,
                "fps": 12
            },
            "leaf": {
                "src": "assets/scene/fx/leaf.png",
                "fw": 9,
                "fh": 7,
                "frames": 8,
                "fps": 6
            },
            "snow": {
                "src": "assets/scene/fx/snow.png",
                "fw": 8,
                "fh": 8,
                "frames": 7,
                "fps": 6
            }
        },
        "props": {
            "arrow": {
                "src": "assets/scene/props/arrow.png",
                "w": 24,
                "h": 5
            },
            "coin": {
                "src": "assets/scene/props/coin.png",
                "w": 7,
                "h": 7
            },
            "chest": {
                "src": "assets/scene/props/chest.png",
                "w": 16,
                "h": 14,
                "frames": 2
            },
            "entrance": {
                "src": "assets/scene/props/entrance.png",
                "w": 126,
                "h": 156
            }
        },
        "credits": [
            {
                "pack": "Hero Knight, Martial Hero 1/2, Fantasy Warrior, Huntress 2, Evil Wizard 1/2, Medieval Warrior 1/2/3, Medieval King, Monsters Creatures Fantasy 1/2, Pet Dogs",
                "author": "LuizMelo",
                "url": "https://luizmelo.itch.io/",
                "license": "CC0"
            },
            {
                "pack": "Ninja Adventure",
                "author": "Pixel-boy & AAA",
                "url": "https://pixel-boy.itch.io/ninja-adventure-asset-pack",
                "license": "CC0"
            },
            {
                "pack": "Legacy Fantasy - High Forest",
                "author": "Anokolisa",
                "url": "https://anokolisa.itch.io/sidescroller-pixelart-sprites-asset-pack-forest-16x16",
                "license": "Gratuito, uso comercial permitido com crédito"
            },
            {
                "pack": "Parallax Forest",
                "author": "ansimuz",
                "url": "https://ansimuz.itch.io/parallax-forest",
                "license": "Gratuito para uso pessoal e comercial"
            }
        ]
    };
})(window.Aethra = window.Aethra || {});
