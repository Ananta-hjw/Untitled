import { interiorArtRect } from '../world/interiors';
import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { bladeHitsEllipse, clipBladeSweep, type Blade } from '../combat/blade';
import { CombatEffects, type AttackEffect } from '../combat/CombatEffects';
import { Enemy } from '../combat/Enemy';
import { preloadMonsters } from '../combat/MonsterSprite';
import { ASH_SLOW, enemyHitReaches, type EnemyHit } from '../combat/monsterTypes';
import { isJustDodge, slowMotionScale, strikeReaches } from '../combat/justDodge';
import { critMultiplier, gameTimeScale, heavierKind, hitStopMs, strikeKind, type HitKind } from '../combat/hitFeel';
import { ImpactEffects } from '../combat/ImpactEffects';
import {
  DEPTH_LIGHTING,
  DODGE,
  JUST_DODGE,
  ENEMY,
  KNOCKBACK_DAMPING,
  PLAYER,
  PLAYER_SPEED,
  VERTICAL_SPEED_RATIO,
  VIEW_HEIGHT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  HIT_FEEL,
  HERO_WALK_NATURAL_SPEED,
  MANA,
  SPIN_SLASH,
  BLOCK,
} from '../config';
import { addMana, inSpinRadius, regenMana } from '../combat/mana';
import { allocate, deriveStats, mitigate, pointsLeft, totalStats, type DerivedStats, type StatId } from '../entities/attributes';
import { CHARACTER_SAVE_KEY, newCharacter, parseCharacter, serializeCharacter, type CharacterData } from '../entities/characterData';
import { GEAR, SLOT_INFO, buyGear, equip, gearBonus, sellGear, unequip, type GearId } from '../items/equipment';
import { CharacterPanel, type CharacterTab, type CharacterView } from '../ui/CharacterPanel';
import { preloadIcons } from '../ui/icons';
import { dodgeDistanceRatio, lungeProgress, locomotionRate } from '../entities/movement';
import { Character } from '../entities/Character';
import { addXp, statsForLevel, xpToNext, type LevelStats, type Progress } from '../entities/progression';
import { browserStorage, loadProgress, saveProgress, type SaveStorage } from '../entities/saveData';
import { ActionButton } from '../ui/ActionButton';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HERO_SPRITE_HEIGHT, HeroSprite, preloadHeroSprite } from '../entities/HeroSprite';
import { attackFacingFor, attackVector, insideAttackLane, movementFacing, strikePoseStart } from '../entities/heroFrames';
import { createPlaceholderArt } from '../world/placeholderArt';
import type { WalkArea } from '../world/walkArea';
import { NavGrid } from '../world/navGrid';
import { buildMap, preloadVillage } from '../world/village';
import { MAPS, START_MAP, fieldPoint, findExit, isMapId, type GameMap, type MapExit, type MapId, type Point } from '../world/maps';
import { Hud } from '../ui/Hud';
import { DamageNumbers } from '../ui/DamageNumbers';
import { DialogueBox, preloadDialogue } from '../ui/DialogueBox';
import { PauseMenu } from '../ui/PauseMenu';
import { TITLE_FADE_MS } from './TitleScene';
import { justDodgeWindowMs, loadSettings, saveSettings, sizeScale, type Settings } from '../ui/settingsData';
import { DIALOGUES, HERO_NAME } from '../story/dialogues';
import { findInteractable, type Interactable } from '../world/interactables';
import { MARKER_STYLE, Npc, preloadNpcs } from '../entities/Npc';
import { NPCS, nextStressCount, stressNpcs } from '../world/npcs';
import { PerfOverlay } from '../ui/PerfOverlay';
import { Minimap } from '../ui/Minimap';
import { QuestTracker } from '../ui/QuestTracker';
import { StoryChoice } from '../ui/StoryChoice';
import { CLINIC_BED_SPOT, HOME_BED_SPOT, REST_POINTS, herbBonus, REST_SAVE_KEY, canRest, parseRestPoint, serializeRestPoint, type RestPointId } from '../story/restPoints';
import { DUSK_MOTH_POINTS, chapterPhase, chapterNpcs, chapterSpots, chapterDialogue, isDusk, raidSpawns, INSPECTION_LINES } from '../story/chapterOne';
import {
  currentObjective, MARKER_PRIORITY, QUEST_SAVE_KEY, markerFor, parseQuests, recordEvent, serializeQuests, talkTo, type QuestEvent, type QuestMarker, type QuestState,
} from '../story/quests';
import { GUARDS, guardsForMap } from '../world/guards';
import type { NpcId } from '../world/npcs';
import { QuickSlotPanel } from '../ui/QuickSlotPanel';
import { loadQuickSlots, saveQuickSlots, type QuickSlots } from '../items/quickSlots';
import { ITEM_ICON_TEXTURE, preloadItemIcons, registerItemIcons } from '../ui/itemIcons';
import { ItemPanel, type PanelAction } from '../ui/ItemPanel';
import { WorldMap } from '../ui/WorldMap';
import { ExitHint } from '../ui/ExitHint';
import { VISITED_SAVE_KEY, parseVisited, regionOf, serializeVisited, type RegionId } from '../world/worldMap';
import {
  INVENTORY_SAVE_KEY, ITEMS, USE_COOLDOWN_MS, addGold, addItem, applyDrop, buy, countOf, parseInventory,
  sell, serializeInventory, slimeDrop, useItem, type Inventory, type ItemId,
} from '../items/inventory';
import { ProgressEffects } from '../ui/ProgressEffects';

/** Scale shared by all academy frames. */
const HERO_SCALE = 0.5;
const NAV_CELL = 32;
/** 맵을 옮길 때 화면이 어두워졌다 밝아지는 시간(ms). 연출만 담당하고 게임 시계와는 무관하다. */
const TRAVEL_FADE_MS = 220;

/** scene.restart()로 넘기는 값. 아무것도 넘기지 않으면 지금 맵에서 다시 시작한다. */
interface SceneData {
  map?: MapId;
  /** 처음 화면에서 시작하기를 눌러 들어왔다: 화면을 스르르 밝힌다. */
  fromTitle?: boolean;
  /** 성능 테스트 인원 (0 = 끔) */
  stress?: number;
  /** 도착 지점. 없으면 맵의 시작 지점 */
  at?: Point;
  /** 맵을 옮길 때 이어지는 체력. 한 번 쓰고 지운다. */
  hp?: number;
  /** 맵을 옮길 때 이어지는 약초 기운(최대 체력 보너스). 한 번 쓰고 지운다. */
  herb?: number;
  /** 맵을 옮길 때 이어지는 마나. 한 번 쓰고 지운다. */
  mp?: number;
}

export class GameScene extends Phaser.Scene {
  private player!: Character;
  private effects!: CombatEffects;
  private joystick!: VirtualJoystick;
  private walkArea!: WalkArea;
  private attackButton!: ActionButton;
  private enemies: Enemy[] = [];
  private attackKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 게임 시계(ms). update()에서만 흐른다. */
  private now = 0;
  private enemyRespawns: Array<{ at: number; enemy: Enemy }> = [];
  private playerRespawnAt?: number;
  private deathMessage?: Phaser.GameObjects.Text;
  private attackTrace?: { startedAt: number; stage: number; direction: { x: number; y: number }; previous: Blade; elapsed: number; hit: Set<Enemy>; effect?: AttackEffect; counter: boolean };
  private nextAttackAt = 0;
  private attackBufferedUntil?: number;
  private keyboardAttackPressed = false;
  private attackLunge?: { startedAt: number; stage: number; direction: { x: number; y: number }; progress: number };
  private comboStage = 0;
  private comboExpiresAt = 0;
  private dodgeButton!: ActionButton;
  /** 막기 버튼(누르고 있는 동안 막는다) */
  private blockButton?: ActionButton;
  private blockKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 지금 막고 있는지 (패링 판정 시간 안인지, updatePlayer가 매 프레임 정한다) */
  private blocking = false;
  /** 패링 판정이 끝나는 시각과, 다시 막을 수 있는 시각 (게임 시계) */
  private parryUntil = 0;
  private parryReadyAt = 0;
  /** 막는 동안 주인공 앞에 그리는 방패 빛 */
  private shield?: Phaser.GameObjects.Graphics;
  private dodgeKeys: Phaser.Input.Keyboard.Key[] = [];
  private dodgeUntil = 0;
  private dodgeProgress = 1;
  private dodgeReadyAt = 0;
  /** 이번 회피를 시작한 시각과 위치. 저스트 회피는 "피하지 않았으면 맞았을 자리"로 판정한다. */
  private dodgeStartedAt?: number;
  private readonly dodgeOrigin = { x: 0, y: 0 };
  /** 이번 회피로 이미 저스트 회피가 났는지 (한 번의 회피에 한 번만) */
  private justDodged = false;
  /** 느린 화면이 끝날 때까지 남은 실제 시간(ms) */
  private slowMotionLeft = 0;
  /** 히트스톱이 끝날 때까지 남은 실제 시간(ms). 그동안 게임 시간이 멈춘다. */
  private hitStopLeft = 0;
  /** 섬광·불꽃·먼지·파편 (게임 시계로 움직인다) */
  private impacts!: ImpactEffects;
  /** 넉백으로 미끄러지는 캐릭터가 마지막으로 먼지를 일으킨 시각 */
  private readonly slideDustAt = new WeakMap<Character, number>();
  /** 이 시각(게임 시계)까지 시작한 공격 한 번은 반격으로 강해진다 */
  private counterUntil = 0;
  private nextGhostAt = 0;
  private readonly dodgeDirection = new Phaser.Math.Vector2();
  private hud!: Hud;
  private damageNumbers!: DamageNumbers;
  private progressEffects!: ProgressEffects;
  private dialogue!: DialogueBox;
  private talkButton!: ActionButton;
  private pauseButton!: ActionButton;
  private pauseMenu!: PauseMenu;
  private pauseKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 조작 설정. 바꿀 때마다 기기에 저장한다. */
  private settings!: Settings;
  /** 설정에 따른 저스트 회피 인정 시간(ms) */
  private justDodgeWindow = JUST_DODGE.windowMs;
  /** 안드로이드 뒤로가기 버튼 리스너 (앱에서만 동작) */
  private backButtonListener?: Promise<PluginListenerHandle>;
  private talkKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 말풍선 표시. 대화할 수 있는 대상 위에 뜬다. */
  private talkMarker!: Phaser.GameObjects.Text;
  /** 플레이어의 레벨과 경험치. 쓰러져도 잃지 않고, 바뀔 때마다 기기에 저장한다. */
  private progress: Progress = { level: 1, xp: 0 };
  private stats: LevelStats = statsForLevel(1);
  /** 능력치 분배와 장비 (untitled-rpg.character에 저장) */
  private character: CharacterData = newCharacter();
  /** 레벨·능력치·장비로 계산한 전투 수치. 바뀔 때마다 recomputeStats()로 다시 만든다. */
  private derived: DerivedStats = deriveStats(1, totalStats(newCharacter().alloc));
  private characterPanel?: CharacterPanel;
  private characterButton?: ActionButton;
  private characterKeys: Phaser.Input.Keyboard.Key[] = [];
  private storage?: SaveStorage;
  private fromTitle = false;
  /** 잿빛 나방의 가루에 닿아 느려진 상태가 끝나는 게임 시각 */
  private slowedUntil = 0;
  /** 지금 있는 맵. 재시작해도 유지되고, 맵을 옮길 때만 바뀐다. */
  private mapId: MapId = START_MAP;
  private map: GameMap = MAPS[START_MAP];
  private arrival?: Point;
  private carriedHp?: number;
  private carriedHerb?: number;
  /** 약초 기운: 치유소에서 치료받으면 붙는 최대 체력 보너스. 처음 맞을 때 사라진다. 0이면 없음 */
  private herb = 0;
  /** 마나 (소수로 흘러가고, 화면에는 내림한 값) */
  private mp = 0;
  private maxMp = 0;
  /** HUD에 마지막으로 그린 마나(정수). 바뀔 때만 다시 그린다. */
  private shownMp = -1;
  private carriedMp?: number;
  /** 회전 베기가 맞히는 시각 (게임 시계). 없으면 쓰는 중이 아님 */
  private spinHitAt?: number;
  private nextSpinAt = 0;
  private skillButton?: ActionButton;
  private skillKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 다른 맵으로 옮겨 가는 중(화면이 어두워지는 동안). 그동안 게임은 멈춘다. */
  private traveling = false;
  private nav!: NavGrid;
  /** 이 맵의 마을 사람들 */
  private npcs: Npc[] = [];
  /** 말을 걸 수 있는 대상: 맵의 표지판·문과 마을 사람들 */
  private interactables: Interactable[] = [];
  /** 성능 테스트로 마을에 더 세우는 사람 수 (0 = 끔). 재시작해도 유지한다. ?stress=100으로도 켤 수 있다. */
  private stressCount = Math.max(0, Math.min(500, Number(new URLSearchParams(location.search).get('stress')) || 0));
  private perf?: PerfOverlay;
  /** 퀘스트 진행. 바뀔 때마다 기기에 저장한다(진행 상황과 따로). */
  private quests: QuestState = {};
  private storyChoice?: StoryChoice;
  private storyMarkers: Phaser.GameObjects.Text[] = [];
  private raidEnemies = new Set<Enemy>();
  private chapterShade?: Phaser.GameObjects.Rectangle;
  /** 마을의 가게 문 위 퀘스트 표시: 안에 있는 사람의 표시를 문 위에 보여 준다. */
  private doorMarkers: Array<{ spot: Interactable; text: Phaser.GameObjects.Text; npcs: NpcId[]; marker?: QuestMarker }> = [];
  private minimap?: Minimap;
  private questTracker?: QuestTracker;
  /** 골드와 아이템. 바뀔 때마다 기기에 저장한다(진행 상황과 따로). */
  private inventory: Inventory = { gold: 0, items: {} };
  private itemPanel?: ItemPanel;
  /** 전체 지도 화면과 가 본 지역 (기기에 따로 저장) */
  private worldMap?: WorldMap;
  private exitHint?: ExitHint;
  private visited = new Set<RegionId>();
  private mapKeys: Phaser.Input.Keyboard.Key[] = [];
  private potionButton?: ActionButton;
  private lunchButton?: ActionButton;
  private lunchKeys: Phaser.Input.Keyboard.Key[] = [];
  private potionKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 다음에 회복 아이템을 쓸 수 있는 시각 (게임 시계) */
  private nextUseAt = 0;
  private quickSlots: QuickSlots = [null, null];
  private quickSlotPanel?: QuickSlotPanel;
  private readonly boundsScratch = new Phaser.Geom.Rectangle();
  private keys?: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private readonly input2 = new Phaser.Math.Vector2();
  private readonly scratch = new Phaser.Math.Vector2();

  constructor() {
    super('game');
  }

  init(data: SceneData = {}): void {
    this.resetState();
    // 맵: 넘겨받은 값 → (개발 빌드) 주소의 ?map= → 지금 맵 순서로 정한다.
    const fromUrl = import.meta.env.DEV ? new URLSearchParams(location.search).get('map') : null;
    // 처음 화면에서 시작할 때는 마지막으로 쉰 곳(여관·시온의 집)에서 시작한다. 쉰 적이 없으면 시온의 집 앞.
    const rested = data.fromTitle && !data.map ? this.loadRestPoint() : undefined;
    if (rested) { data.map = rested.map; data.at = { ...rested.at }; }
    if (isMapId(data.map)) this.mapId = data.map;
    else if (isMapId(fromUrl)) this.mapId = fromUrl;
    this.map = MAPS[this.mapId];
    if (data.stress !== undefined) this.stressCount = data.stress;
    this.arrival = data.at;
    this.fromTitle = !!data.fromTitle;
    // 다음 재시작에 같은 data가 넘어와도 다시 페이드하지 않게 한 번만 쓴다.
    data.fromTitle = undefined;
    this.carriedHp = data.hp;
    // 같은 data가 다음 재시작에도 다시 넘어오므로, 체력은 한 번만 이어 받는다.
    data.hp = undefined;
    this.carriedHerb = data.herb;
    data.herb = undefined;
    this.carriedMp = data.mp;
    data.mp = undefined;
    // 저장된 진행 상황이 있으면 그 레벨로 시작한다 (재시작 포함).
    this.storage = browserStorage();
    this.quests = this.loadQuests();
    this.saveQuests();
    this.inventory = this.loadInventory();
    this.quickSlots = loadQuickSlots(this.storage);
    const cooldown = this.registry.get('quick-item-cooldown');
    this.nextUseAt = typeof cooldown === 'number' && Number.isFinite(cooldown) ? Math.max(0, Math.min(USE_COOLDOWN_MS, cooldown)) : 0;
    // 들어온 지역을 가 본 곳으로 기록한다.
    this.visited = this.loadVisited();
    if (!this.visited.has(regionOf(this.mapId))) {
      this.visited.add(regionOf(this.mapId));
      this.saveVisited();
    }
    const saved = loadProgress(this.storage);
    if (saved) {
      this.progress = saved;
    }
    this.character = this.loadCharacter();
    this.recomputeStats();
  }

  /** 해 질 무렵(chapterOne.isDusk)에는 남쪽 들판에 잿빛 나방이 더 나온다. */
  private duskSpawns(): Array<{ key: 'ashen-moth'; x: number; y: number }> {
    if (this.mapId !== 'south-field' || !isDusk(this.quests)) return [];
    return DUSK_MOTH_POINTS.map(([x, y]) => ({ key: 'ashen-moth', ...fieldPoint(x, y) }));
  }

  private resetState(): void {
    this.slowedUntil = 0;
    this.enemies = [];
    this.npcs = [];
    this.interactables = [];

    this.perf = undefined;
    this.quests = {};
    this.storyChoice = undefined;
    this.storyMarkers = [];
    this.raidEnemies = new Set();
    this.chapterShade = undefined;
    this.doorMarkers = [];
    // 지난 장면의 UI는 재시작 때 사라지므로 새로 만들 때까지 비워 둔다.
    this.minimap = undefined;
    this.questTracker = undefined;
    this.inventory = { gold: 0, items: {} };
    this.itemPanel = undefined;
    this.worldMap = undefined;
    this.exitHint = undefined;
    this.visited = new Set();
    this.mapKeys = [];
    this.potionButton = undefined;
    this.lunchButton = undefined;
    this.lunchKeys = [];
    this.potionKeys = [];
    this.nextUseAt = 0;
    this.quickSlotPanel = undefined;
    this.attackKeys = [];
    this.dodgeKeys = [];
    this.keys = undefined;
    this.now = 0;
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.nextAttackAt = 0;
    this.attackBufferedUntil = undefined;
    this.keyboardAttackPressed = false;
    this.comboStage = 0;
    this.comboExpiresAt = 0;
    this.dodgeUntil = 0;
    this.dodgeProgress = 1;
    this.dodgeReadyAt = 0;
    this.dodgeStartedAt = undefined;
    this.justDodged = false;
    this.slowMotionLeft = 0;
    this.hitStopLeft = 0;
    this.counterUntil = 0;
    this.nextGhostAt = 0;
    this.dodgeDirection.set(0, 0);
    this.input2.set(0, 0);
    this.scratch.set(0, 0);
    this.enemyRespawns = [];
    this.talkKeys = [];
    this.pauseKeys = [];
    this.progress = { level: 1, xp: 0 };
    this.stats = statsForLevel(1);
    this.character = newCharacter();
    this.derived = deriveStats(1, totalStats(this.character.alloc));
    this.characterPanel = undefined;
    this.characterButton = undefined;
    this.characterKeys = [];
    this.blockButton = undefined;
    this.blockKeys = [];
    this.blocking = false;
    this.parryUntil = 0;
    this.parryReadyAt = 0;
    this.shield = undefined;
    this.playerRespawnAt = undefined;
    this.deathMessage = undefined;
    this.traveling = false;
    this.arrival = undefined;
    this.carriedHp = undefined;
    this.carriedHerb = undefined;
    this.herb = 0;
    this.mp = 0;
    this.maxMp = 0;
    this.shownMp = -1;
    this.carriedMp = undefined;
    this.spinHitAt = undefined;
    this.nextSpinAt = 0;
    this.skillButton = undefined;
    this.skillKeys = [];
  }

  preload(): void {
    preloadHeroSprite(this);
    preloadIcons(this);
    preloadMonsters(this, [...this.map.enemies, ...this.duskSpawns()]);
    preloadVillage(this, this.map);
    preloadNpcs(this, [...NPCS, ...GUARDS]);
    preloadDialogue(this);
    preloadItemIcons(this);
  }

  create(): void {
    createPlaceholderArt(this);
    this.walkArea = buildMap(this, this.map);
    const bounds = this.walkArea.bounds;
    this.nav = new NavGrid(bounds.left, bounds.top, bounds.right, bounds.bottom, NAV_CELL,
      (x, y) => this.walkArea.contains(x, y));
    this.buildCharacters();
    this.effects = new CombatEffects(this);
    this.impacts = new ImpactEffects(this);
    this.buildUi();
    this.damageNumbers = new DamageNumbers(this);
    this.progressEffects = new ProgressEffects(this);
    this.dialogue = new DialogueBox(this);
    this.storyChoice = new StoryChoice(this, () => this.onResume());
    if (chapterPhase(this.quests) === 'raid') {
      this.chapterShade = this.add.rectangle(0, 0, this.scale.gameSize.width, VIEW_HEIGHT, 0x122137, 0.42).setOrigin(0).setScrollFactor(0).setDepth(DEPTH_LIGHTING);
      this.player.invulnerableUntil = 1500;
    }
    this.talkMarker = this.add
      .text(0, 0, '···', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#1a1008',
        backgroundColor: '#f5ead2',
        padding: { x: 10, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH_LIGHTING + 4)
      .setResolution(2)
      .setVisible(false);
    this.buildPause();
    this.minimap = new Minimap(this, this.map);
    this.questTracker = new QuestTracker(this);
    registerItemIcons(this);
    this.potionButton = new ActionButton(this, { x: 0, y: 0, radius: 48, label: '', color: 0x3e2221, fontSize: 18, icon: { texture: ITEM_ICON_TEXTURE, frame: 'potion' }, cooldown: true, releaseToPress: true, onLongPress: () => this.openQuickSlot(0) });
    this.lunchButton = new ActionButton(this, { x: 0, y: 0, radius: 48, label: '', color: 0x38442a, fontSize: 18, icon: { texture: ITEM_ICON_TEXTURE, frame: 'lunch' }, cooldown: true, releaseToPress: true, onLongPress: () => this.openQuickSlot(1) });
    this.lunchKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)] : [];
    this.potionButton.setSizeScale(sizeScale(this.settings.buttonSize));
    this.lunchButton.setSizeScale(sizeScale(this.settings.buttonSize));
    this.potionKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)] : [];
    this.skillButton = new ActionButton(this, { x: 0, y: 0, radius: 50, label: `회전베기\nMP ${SPIN_SLASH.cost}`, color: 0x2f5fa8, fontSize: 17 });
    this.skillButton.setSizeScale(sizeScale(this.settings.buttonSize));
    this.skillKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K)] : [];
    this.itemPanel = new ItemPanel(this, (action) => this.onItemAction(action), () => this.onResume(), slot => { this.itemPanel?.close(); this.openQuickSlot(slot); });
    this.quickSlotPanel = new QuickSlotPanel(this, (slot, id) => {
      this.quickSlots[slot] = id;
      saveQuickSlots(this.storage, this.quickSlots);
      this.refreshInventory();
    }, () => this.onResume());
    this.characterPanel = new CharacterPanel(this, {
      allocate: (stat) => this.allocateStat(stat),
      equip: (id, slot) => this.changeGear(equip(this.character.gear, id, slot), `${GEAR[id].name} 장착`),
      unequip: (slot) => this.changeGear(unequip(this.character.gear, slot), `${SLOT_INFO[slot].name} 장비 해제`),
      use: (id) => this.onItemAction({ type: 'use', id }),
      buy: (id) => this.tradeGear(id, 'buy'),
      sell: (id) => this.tradeGear(id, 'sell'),
      close: () => this.onResume(),
    });
    // 캐릭터 창 버튼(일시정지 버튼 아래). I: 아이템, C: 상태
    this.characterButton = new ActionButton(this, { x: 0, y: 0, radius: 30, label: '정보', color: 0x2a2018, fontSize: 17 });
    this.characterKeys = this.input.keyboard
      ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C), this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I)] : [];
    this.worldMap = new WorldMap(this, this.map, () => this.onResume());
    this.exitHint = new ExitHint(this, this.map);
    this.minimap.onTap(() => this.openWorldMap());
    this.mapKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M)] : [];
    this.refreshInventory();
    this.refreshQuests();
    this.layout();
    if (this.stressCount > 0) this.perf = new PerfOverlay(this, () => this.npcs.length);

    this.setCameraBounds();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, 170);
    if (this.fromTitle) this.cameras.main.fadeIn(TITLE_FADE_MS, 0, 0, 0);
    else if (this.arrival) this.cameras.main.fadeIn(TRAVEL_FADE_MS, 0, 0, 0);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.game.events.on(Phaser.Core.Events.BLUR, this.clearAttackInput, this);
    // 앱을 내리거나 다른 앱으로 넘어가면 돌아왔을 때 일시정지 상태로 보여 준다.
    this.game.events.on(Phaser.Core.Events.HIDDEN, this.openPause, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.game.events.off(Phaser.Core.Events.BLUR, this.clearAttackInput, this);
      this.game.events.off(Phaser.Core.Events.HIDDEN, this.openPause, this);
      void this.backButtonListener?.then((listener) => listener.remove()).catch(() => undefined);
      this.backButtonListener = undefined;
      this.registry.set('quick-item-cooldown', Math.max(0, this.nextUseAt - this.now));
      this.resetState();
    });
    this.layout();

    if (new URLSearchParams(location.search).has('debug')) this.drawDebug();
  }

  update(_time: number, delta: number): void {
    this.perf?.update(delta);
    // 히트스톱이나 일시정지로 게임 시계가 멈추면 불꽃도 그 자리에 멈춘다.
    this.impacts?.update(this.now, delta);
    if (this.player) {
      this.minimap?.update(delta, this.player, this.collectMinimap);
      this.exitHint?.update(this.player, this.traveling || !this.player.alive || this.dialogue.isOpen || this.pauseMenu.isOpen
        || !!this.worldMap?.isOpen || !!this.itemPanel?.isOpen || !!this.characterPanel?.isOpen || !!this.storyChoice?.isOpen || !!this.quickSlotPanel?.isOpen,
        chapterPhase(this.quests) === 'raid' && this.mapId === 'village');
    }
    this.setQuickButtonsVisible(!this.traveling && !!this.player?.alive && !this.dialogue.isOpen && !this.pauseMenu.isOpen
      && !this.characterPanel?.isOpen && !this.itemPanel?.isOpen && !this.worldMap?.isOpen && !this.storyChoice?.isOpen && !this.quickSlotPanel?.isOpen);
    // 게임 안의 모든 시간 계산은 이 시계 하나만 쓴다.
    // 프레임이 끊겨도 이동 거리와 타이밍이 서로 어긋나지 않게 하기 위해서다.
    const step = Math.min(delta, 50);
    // 맵을 옮기는 동안에는 아무것도 진행하지 않는다.
    if (this.traveling) return;

    // 일시정지 중에는 게임 시계를 멈춘다. Esc는 메뉴에서 한 단계 뒤로.
    let escape = false;
    for (const key of this.pauseKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) escape = true;
    }
    if (this.quickSlotPanel?.isOpen) {
      if (escape) this.quickSlotPanel.close();
      return;
    }
    if (this.storyChoice?.isOpen) {
      if (escape) this.storyChoice.cancel();
      else if (this.talkKeys.some(key => key.keyCode === Phaser.Input.Keyboard.KeyCodes.ENTER && Phaser.Input.Keyboard.JustDown(key))) this.storyChoice.accept();
      return;
    }
    if (this.pauseMenu.isOpen) {
      if (escape) this.pauseMenu.back();
      return;
    }
    // 가방·잡화점이 열려 있으면 게임 시계를 멈춘다. Esc로 닫는다.
    if (this.itemPanel?.isOpen) {
      if (escape) this.itemPanel.close();
      return;
    }
    // 캐릭터 창(상태·장비·아이템)도 열려 있으면 게임 시계를 멈춘다. Esc나 같은 키로 닫는다.
    const characterKey = this.characterKeys.find((key) => Phaser.Input.Keyboard.JustDown(key));
    if (this.characterPanel?.isOpen) {
      if (escape || characterKey) this.characterPanel.close();
      return;
    }
    if (this.characterButton?.consumePress()) this.openCharacterPanel('status');
    else if (characterKey) this.openCharacterPanel(characterKey.keyCode === Phaser.Input.Keyboard.KeyCodes.I ? 'items' : 'status');
    if (this.characterPanel?.isOpen) return;
    // 전체 지도도 열려 있으면 게임 시계를 멈춘다. Esc나 M으로 닫는다.
    let mapKey = false;
    for (const key of this.mapKeys) if (Phaser.Input.Keyboard.JustDown(key)) mapKey = true;
    if (this.worldMap?.isOpen) {
      this.worldMap.update(this.time.now);
      if (escape || mapKey) this.worldMap.close();
      return;
    }
    if (mapKey) {
      this.openWorldMap();
      return;
    }
    if (this.pauseButton.consumePress() || escape) {
      this.openPause();
      return;
    }

    // 대화 중에는 게임 시계를 멈춘다. 적·타이머·부활이 모두 그대로 기다린다.
    if (this.dialogue.isOpen) {
      this.dialogue.update(step);
      // 대화 키(E·Enter)와 공격 키(Space·J) 모두 넘기기로 쓴다.
      let advance = this.talkPressed();
      for (const key of this.attackKeys) {
        if (Phaser.Input.Keyboard.JustDown(key)) advance = true;
      }
      if (advance) this.dialogue.advance();
      return;
    }

    // 타격 순간에는 게임 시간을 아주 잠깐 멈추고(히트스톱), 저스트 회피 뒤에는 느리게 흘린다.
    // 적·플레이어·주인공 그림·타이머가 모두 이 시간을 따르므로 서로 어긋나지 않는다.
    const slow = slowMotionScale(this.slowMotionLeft, JUST_DODGE.slowScale, JUST_DODGE.rampMs);
    this.hud.setSlowMotion((1 - slow) / (1 - JUST_DODGE.slowScale));
    const gameStep = step * gameTimeScale(this.hitStopLeft, this.slowMotionLeft);
    this.slowMotionLeft = Math.max(0, this.slowMotionLeft - step);
    this.hitStopLeft = Math.max(0, this.hitStopLeft - step);
    // 멈춘 동안에는 아무것도 진행하지 않는다. 눌린 입력은 그대로 남아 있다가 다음 프레임에 처리된다.
    if (gameStep === 0) return;

    if (this.player.sprite instanceof HeroSprite) this.player.sprite.advance(gameStep);

    this.now += gameStep;
    const time = this.now;
    const dt = gameStep / 1000;

    this.effects.update(time);
    this.updateRespawns(time);
    this.updateAttackLunge(time);
    this.updatePlayer(time, dt);
    this.drawShield(time);
    if (this.checkExit()) return;
    this.updateAttackTrace(time);
    this.nav.setTarget(this.player.x, this.player.y);
    for (const enemy of this.enemies) {
      enemy.update(time, dt, this.player, this.walkArea, this.nav, this.onEnemyStrike);
      this.applyKnockback(enemy.character, dt);
    }
    this.separateEnemies(dt);
    for (const npc of this.npcs) npc.update(time, dt, this.player, this.walkArea);
    for (const door of this.doorMarkers) if (door.marker) door.text.setY(door.spot.y - 150 - Math.abs(Math.sin(time / 320)) * 8);
    this.applyKnockback(this.player, dt);
    this.damageNumbers.update(gameStep);
    this.updateInteraction(time);
    this.updatePotion(time);
    this.updateSkill(time, gameStep);
  }

  // ---------------------------------------------------------------- 월드

  private buildCharacters(): void {
    for (const spawn of [...this.map.enemies, ...this.duskSpawns()]) this.enemies.push(new Enemy(this, spawn.key, spawn.x, spawn.y));
    for (const point of raidSpawns(this.quests, this.mapId)) {
      const enemy = new Enemy(this, 'retainer-ash', point.x, point.y);
      this.enemies.push(enemy);
      this.raidEnemies.add(enemy);
    }
    let defs = chapterNpcs([...this.map.npcs, ...guardsForMap(this.mapId)], this.quests, this.mapId);
    if (this.stressCount > 0 && this.mapId === 'village' && chapterPhase(this.quests) === 'day') {
      const area = this.walkArea, b = this.map.bounds;
      defs = [...defs, ...stressNpcs(this.stressCount, defs, Math.random, b, (x, y) => area.contains(x, y) && !findExit(this.map, x, y))];
    }
    this.npcs = defs.map((def) => new Npc(this, def));
    this.interactables = [...this.map.interactables, ...this.npcs.map((npc) => npc.spot),
      // 시온의 집 침대 앞: 쉬기 (저장)
      ...(this.mapId === 'in-home' ? [{ ...HOME_BED_SPOT }] : []),
      // 치유소 침대 옆: 치료받기 (저장하지 않음)
      ...(this.mapId === 'in-clinic' ? [{ ...CLINIC_BED_SPOT }] : [])];
    for (const spot of this.map.interactables) {
      if (!spot.enter) continue;
      // 문 위의 퀘스트 표시: 지금 그 건물 안에 있는 사람(이야기 진행에 따라 다르다, 예: 습격 뒤의 에일라)
      const to = spot.enter.to;
      const inside = isMapId(to) ? chapterNpcs(MAPS[to].npcs, this.quests, to).map((n) => n.id) : [];
      if (inside.length === 0) continue;
      const text = this.add.text(spot.x, spot.y - 150, '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '40px', fontStyle: 'bold', color: '#ffd23f', stroke: '#1a1008', strokeThickness: 7,
      }).setOrigin(0.5, 1).setDepth(spot.y + 400).setResolution(2).setVisible(false);
      this.doorMarkers.push({ spot, text, npcs: inside });
    }

    const start = this.arrival ?? this.map.spawn;
    this.player = new Character(this, start.x, start.y, {
      key: 'hero',
      name: HERO_NAME,
      level: this.progress.level,
      hero: true,
      scale: HERO_SCALE,
      labelOffset: HERO_SPRITE_HEIGHT * HERO_SCALE + 8,
      shadowWidth: 110,
      maxHp: this.stats.maxHp,
    });
    if (this.carriedHerb) {
      // 맵을 옮겨도 약초 기운은 이어진다.
      this.herb = herbBonus(this.stats.maxHp);
      this.player.setMaxHp(this.stats.maxHp + this.herb, true);
    }
    // 마나: 처음에는 가득, 맵을 옮길 때는 이어 받는다.
    this.maxMp = this.derived.maxMp;
    this.mp = this.carriedMp !== undefined ? Phaser.Math.Clamp(this.carriedMp, 0, this.maxMp) : this.maxMp;
    if (this.carriedHp !== undefined) this.player.hp = Phaser.Math.Clamp(Math.round(this.carriedHp), 1, this.player.maxHp);
  }

  // ---------------------------------------------------------------- 맵 이동

  /** 발이 출구 영역에 들어가면 연결된 맵으로 옮겨 간다. 옮기기 시작했으면 true. */
  private checkExit(): boolean {
    const player = this.player;
    if (!player.alive) return false;
    if (chapterPhase(this.quests) === 'raid' && this.mapId === 'village') return false;
    const exit = findExit(this.map, player.x, player.y);
    if (!exit) return false;
    this.travel(exit);
    return true;
  }

  /** 화면을 어둡게 한 뒤 장면을 새 맵으로 다시 시작한다. 레벨·경험치는 저장되어 있어 그대로 이어진다. */
  private travel(exit: MapExit): void {
    this.traveling = true;
    this.clearAttackInput();
    this.player.setMotion(false);
    this.talkButton.setVisible(false);
    this.talkMarker.setVisible(false);
    const data: SceneData = { map: exit.to, at: exit.arrive, hp: this.player.hp, herb: this.herb, mp: this.mp };
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart(data));
    camera.fadeOut(TRAVEL_FADE_MS, 0, 0, 0);
  }

  // ---------------------------------------------------------------- UI

  private buildUi(): void {
    // 포인터 수는 main.ts의 activePointers로 설정한다. 재시작 때 추가하지 않는다.
    this.joystick = new VirtualJoystick(this, { x: 190, y: VIEW_HEIGHT - 170 });

    this.attackButton = new ActionButton(this, { x: 0, y: VIEW_HEIGHT - 170, label: '공격' });
    this.talkButton = new ActionButton(this, {
      x: 0,
      y: VIEW_HEIGHT - 340,
      radius: 56,
      label: '대화',
      color: 0x3d6b3a,
      fontSize: 24,
    });
    this.talkButton.setVisible(false);
    // 대화창은 화면 어디를 눌러도 넘어간다.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDialoguePointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDialoguePointer, this);
    });
    this.dodgeButton = new ActionButton(this, {
      x: 0,
      y: VIEW_HEIGHT - 95,
      radius: 56,
      label: '회피',
      color: 0x2f4a86,
      fontSize: 24,
    });
    this.blockButton = new ActionButton(this, { x: 0, y: 0, radius: 44, label: '막기', color: 0x5a6b7a, fontSize: 20 });
    this.blockKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L)] : [];
    this.shield = this.add.graphics().setVisible(false);

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.attackKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J),
      ];
      for (const key of this.attackKeys) key.on('down', this.onAttackKeyDown, this);
      const attackKeys = this.attackKeys;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        for (const key of attackKeys) key.off('down', this.onAttackKeyDown, this);
      });
      this.talkKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      ];
      this.dodgeKeys = [
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
        keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K),
      ];
      this.keys = keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.UP,
        down: Phaser.Input.Keyboard.KeyCodes.DOWN,
        left: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
        w: Phaser.Input.Keyboard.KeyCodes.W,
        a: Phaser.Input.Keyboard.KeyCodes.A,
        s: Phaser.Input.Keyboard.KeyCodes.S,
        d: Phaser.Input.Keyboard.KeyCodes.D,
      }) as GameScene['keys'];
    }

    this.hud = new Hud(this, this.mapId === 'village' && chapterPhase(this.quests) === 'raid' ? '마을 습격 · 권속을 저지하고 주민들의 안전을 확인하세요'
      : this.duskSpawns().length ? '해 질 무렵의 남쪽 들판 · 처음 보는 잿빛 나방이 날아다닙니다' : this.map.hint);
    this.drawHud();
  }

  private drawHud(): void {
    this.hud.setHp(this.player.hp, this.player.maxHp, this.herb);
    this.drawMp(true);
    this.hud.setXp(this.progress.level, this.progress.xp, xpToNext(this.progress.level));
  }

  /** 마나 막대는 보이는 값(정수)이 바뀔 때만 다시 그린다. */
  private drawMp(force = false): void {
    const shown = Math.floor(this.mp);
    if (!force && shown === this.shownMp) return;
    this.shownMp = shown;
    this.hud.setMp(shown, this.maxMp);
  }

  /** 화면 너비가 바뀔 때(회전, 창 크기 변경) 화면에 고정된 요소를 다시 배치한다. */
  /**
   * 카메라가 움직일 수 있는 범위. 바깥 맵은 월드 전체, 실내는 방 둘레만.
   * 방이 화면보다 작으면 방이 화면 가운데 오도록 범위를 화면 크기만큼 넓힌다.
   */
  private setCameraBounds(): void {
    const camera = this.cameras.main;
    const interior = this.map.interior;
    if (!interior) {
      camera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      return;
    }
    const { left, right, top, bottom } = interiorArtRect(interior);
    const viewW = this.scale.gameSize.width / camera.zoom, viewH = VIEW_HEIGHT / camera.zoom;
    const width = Math.max(right - left, viewW), height = Math.max(bottom - top, viewH);
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    camera.setBounds(cx - width / 2, cy - height / 2, width, height);
  }

  private layout(): void {
    const { width } = this.scale.gameSize;
    if (this.map) this.setCameraBounds();
    this.hud.layout(width);
    this.attackButton.setPosition(width - 170, VIEW_HEIGHT - 185);
    this.dodgeButton.setPosition(width - 330, VIEW_HEIGHT - 105);
    // 막기 버튼은 공격 버튼 오른쪽 아래 모서리
    this.blockButton?.setPosition(width - 58, VIEW_HEIGHT - 58);
    // 대화 버튼은 공격 버튼 바로 위. 버튼 크기 설정이 바뀌어도 겹치지 않게 간격을 다시 잡는다.
    this.talkButton.setPosition(width - 170, VIEW_HEIGHT - 185 - this.attackButton.size - this.talkButton.size - 16);
    this.pauseButton.setPosition(width - 46, 74);
    this.characterButton?.setPosition(width - 46, 148);
    this.characterPanel?.layout(width);
    // 미니맵은 일시정지 버튼 왼쪽, 퀘스트 목록은 그 아래에 오른쪽으로 맞춘다.
    this.minimap?.layout(width - 172, 92);
    if (this.minimap) this.questTracker?.layout(width - 20, this.minimap.bottom + 4);
    // 두 아이템과 전투 버튼의 실제 터치 반경(1.2배) 사이에 여유를 둔다.
    const itemSize = this.potionButton?.size ?? 48;
    const itemY = VIEW_HEIGHT - 105 - this.dodgeButton.size * 1.2 - itemSize * 1.2 - 20;
    this.potionButton?.setPosition(width - 350, itemY);
    this.lunchButton?.setPosition(width - 350 - itemSize * 2.4 - 16, itemY);
    this.skillButton?.setPosition(width - 350, itemY - itemSize * 1.2 - (this.skillButton?.size ?? 50) * 1.2 - 16);
    this.itemPanel?.layout(width);
    this.quickSlotPanel?.layout(width);
    this.worldMap?.layout(width);
    this.exitHint?.layout(width);
    this.dialogue.layout(width);
    this.storyChoice?.layout(width);
    this.chapterShade?.setSize(width, VIEW_HEIGHT);
    this.pauseMenu.layout(width);
  }

  // ---------------------------------------------------------------- 이동

  private readInput(): Phaser.Math.Vector2 {
    const v = this.input2.copy(this.joystick.vector);
    if (v.lengthSq() === 0 && this.keys) {
      const k = this.keys;
      v.set(
        (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
        (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
      );
      if (v.lengthSq() > 1) v.normalize();
    }
    return v;
  }

  private updatePlayer(time: number, dt: number): void {
    const player = this.player;
    let dodgePressed = this.dodgeButton.consumePress();
    for (const key of this.dodgeKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) dodgePressed = true;
    }
    const attackPressed = this.attackButton.consumePress() || this.keyboardAttackPressed;
    this.keyboardAttackPressed = false;
    let parryPressed = this.blockButton?.consumePress() ?? false;
    for (const key of this.blockKeys) if (Phaser.Input.Keyboard.JustDown(key)) parryPressed = true;
    this.blocking = false;
    if (!player.alive) {
      this.attackBufferedUntil = undefined;
      return;
    }

    if (this.attackBufferedUntil !== undefined && time > this.attackBufferedUntil) {
      this.attackBufferedUntil = undefined;
    }
    if (attackPressed) this.attackBufferedUntil = time + PLAYER.attackBufferMs;

    const v = this.readInput();
    const force = v.length();

    this.dodgeButton.setEnabled(time >= this.dodgeReadyAt);

    if (this.dodgeProgress < 1) {
      this.updateDodge(time);
      if (this.dodgeProgress === 1) player.setDodging(false);
      return;
    }
    player.setDodging(false);

    if (dodgePressed && time >= this.dodgeReadyAt) {
      this.startDodge(time, v);
      return;
    }

    // 초 단위 애니메이션과 밀리초 시계의 부동소수점 오차로 한 프레임 쉬지 않게 한다.
    if (this.wantsAttack(time) && time + 1e-6 >= this.nextAttackAt) {
      this.startAttack(time, v.x, v.y);
      this.attackBufferedUntil = undefined;
    }
    // 막기(패링): 누르는 순간부터 짧게만 막는다. 공격·회전 베기 중에는 시작하지 않는다.
    this.blockButton?.setEnabled(time >= this.parryReadyAt);
    if (parryPressed && time >= this.parryReadyAt && !player.isAttacking && this.spinHitAt === undefined) {
      this.parryUntil = time + BLOCK.windowMs;
      this.parryReadyAt = time + BLOCK.cooldownMs;
      this.dismissHint();
    }
    this.blocking = time < this.parryUntil && !player.isAttacking;

    const fromX = player.x;
    const fromY = player.y;
    if (force > 0) {
      const speed = PLAYER_SPEED * (player.isAttacking ? PLAYER.attackMoveRatio : 1) * (this.now < this.slowedUntil ? ASH_SLOW.speedScale : 1)
        * (this.blocking ? BLOCK.moveScale : 1);
      const next = this.walkArea.move(
        player.x,
        player.y,
        v.x * speed * dt,
        v.y * speed * VERTICAL_SPEED_RATIO * dt,
        this.scratch,
      );
      player.placeAt(next.x, next.y);
      this.dismissHint();
    }
    const rate = locomotionRate(player.x - fromX, player.y - fromY, dt, PLAYER_SPEED);
    // 걸음 그림은 실제로 움직인 속도에 맞춘다 (발이 바닥에서 미끄러지지 않게).
    player.setMotion(rate > 0, v.x, rate * PLAYER_SPEED / HERO_WALK_NATURAL_SPEED);
    if (player.sprite instanceof HeroSprite) player.sprite.setMovement(player.x - fromX, player.y - fromY);
  }

  private dismissHint(): void {
    this.hud.dismissHint();
  }

  /** 밀려남을 적용하고 서서히 줄인다. 벽은 통과하지 못한다. */
  private applyKnockback(character: Character, dt: number): void {
    const k = character.knockback;
    if (k.lengthSq() < 4) {
      k.set(0, 0);
      return;
    }
    if (character.alive) {
      const next = this.walkArea.move(character.x, character.y, k.x * dt, k.y * dt, this.scratch);
      character.placeAt(next.x, next.y);
      // 세게 밀려나면 발밑에 흙먼지가 인다.
      if (k.lengthSq() > 260 * 260 && this.now - (this.slideDustAt.get(character) ?? -1e9) > 70) {
        this.slideDustAt.set(character, this.now);
        this.impacts.dust(character.x, character.y, 1, this.now, 20);
      }
    }
    k.scale(Math.max(0, 1 - KNOCKBACK_DAMPING * dt));
  }

  private separateEnemies(dt: number): void {
    const push = ENEMY.separationSpeed * dt;
    for (let i = 0; i < this.enemies.length; i++) {
      const a = this.enemies[i].character;
      if (!a.alive) continue;
      for (let j = i + 1; j < this.enemies.length; j++) {
        const b = this.enemies[j].character;
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        if (Math.abs(dx) >= ENEMY.separationX || Math.abs(dy) >= ENEMY.separationY) continue;
        // 완전히 같은 자리에 있으면 순서대로 좌우로 나눈다.
        const side = dx === 0 ? 1 : Math.sign(dx);
        let next = this.walkArea.move(a.x, a.y, -side * push, 0, this.scratch);
        a.placeAt(next.x, next.y);
        next = this.walkArea.move(b.x, b.y, side * push, 0, this.scratch);
        b.placeAt(next.x, next.y);
      }
    }
  }

  // ---------------------------------------------------------------- 전투

  private onAttackKeyDown(): void {
    // JustDown은 같은 프레임의 keyup에서 지워지므로 눌림 이벤트를 별도로 기억한다.
    this.keyboardAttackPressed = true;
  }

  private clearAttackInput(): void {
    this.attackBufferedUntil = undefined;
    this.keyboardAttackPressed = false;
    this.attackButton?.consumePress();
    this.skillButton?.consumePress();
  }

  private wantsAttack(time = this.now): boolean {
    return this.attackButton.isDown || this.attackKeys.some((key) => key.isDown) ||
      (this.attackBufferedUntil !== undefined && time <= this.attackBufferedUntil);
  }

  /** 회피 시작. 조이스틱 방향으로, 입력이 없으면 바라보는 쪽으로 미끄러진다. */
  private startDodge(time: number, input: Phaser.Math.Vector2): void {
    const player = this.player;
    this.dismissHint();
    this.clearAttackInput();
    player.endAttack();
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.comboStage = 0;

    if (input.lengthSq() > 0.04) {
      this.dodgeDirection.copy(input).normalize();
      player.face(input.x);
    } else {
      this.dodgeDirection.set(player.facing, 0);
    }

    this.dodgeUntil = time + DODGE.durationMs;
    this.dodgeProgress = 0;
    this.dodgeStartedAt = time;
    this.impacts.dust(player.x, player.y, 5, time, 50);
    this.dodgeOrigin.x = player.x;
    this.dodgeOrigin.y = player.y;
    this.justDodged = false;
    // 민첩(DEX)이 높을수록 회피를 빨리 다시 쓴다.
    this.dodgeReadyAt = time + DODGE.cooldownMs * this.derived.dodgeCooldown;
    this.nextAttackAt = Math.max(this.nextAttackAt, this.dodgeUntil);
    this.nextGhostAt = 0;
    player.invulnerableUntil = Math.max(player.invulnerableUntil, this.dodgeUntil + DODGE.graceMs);
    player.knockback.set(0, 0);
    player.setDodging(true);
    this.dodgeButton.setEnabled(false);
  }

  private updateDodge(time: number): void {
    const player = this.player;
    const elapsed = time + 1e-6 >= this.dodgeUntil
      ? DODGE.durationMs : time - (this.dodgeUntil - DODGE.durationMs);
    const progress = dodgeDistanceRatio(elapsed / DODGE.durationMs);
    const distance = (progress - this.dodgeProgress) * DODGE.distance;
    this.dodgeProgress = progress;
    const next = this.walkArea.move(
      player.x,
      player.y,
      this.dodgeDirection.x * distance,
      this.dodgeDirection.y * distance * VERTICAL_SPEED_RATIO,
      this.scratch,
    );
    player.placeAt(next.x, next.y);

    if (time >= this.nextGhostAt) {
      this.nextGhostAt = time + 45;
      if (player.sprite instanceof HeroSprite || player.sprite instanceof Phaser.GameObjects.Sprite) {
        this.effects.spawnGhost(player.sprite, player.x, player.y, player.y - 1, time);
      }
    }
  }

  private startAttack(time: number, inputX: number, inputY = 0): void {
    const player = this.player;
    if (time > this.comboExpiresAt) this.comboStage = 0;
    const stage = this.comboStage;
    const combo = PLAYER.combo[stage];
    this.nextAttackAt = time + combo.intervalMs;
    this.comboExpiresAt = this.nextAttackAt + PLAYER.comboWindowMs;
    this.comboStage = (stage + 1) % PLAYER.combo.length;
    this.dismissHint();
    if (stage === PLAYER.combo.length - 1) this.questEvent({ type: 'finisher' });

    const hero = player.sprite;
    if (!(hero instanceof HeroSprite)) return;
    let facing = attackFacingFor(hero.lookDirection, player.facing);
    // Input wins. Otherwise retain the last facing unless an aimable enemy is nearby.
    if (Math.hypot(inputX, inputY) > 0.25) {
      facing = attackFacingFor(movementFacing(inputX, inputY, hero.lookDirection, false), player.facing);
    } else {
      let nearest = PLAYER.autoFaceRange;
      for (const enemy of this.enemies) {
        const c = enemy.character;
        if (!c.alive) continue;
        const dx = c.x - player.x, dy = (c.y - player.y) / VERTICAL_SPEED_RATIO;
        const candidate = movementFacing(dx, dy, hero.lookDirection, false);
        if (candidate === 'up' || candidate === 'down') continue;
        const distance = Math.hypot(dx, dy);
        if (distance < nearest) {
          nearest = distance;
          facing = candidate;
        }
      }
    }

    const direction = attackVector(facing);
    player.face(direction.x);
    hero.setAttackFacing(facing);
    player.playAttack(stage + 1);
    this.attackLunge = { startedAt: time, stage, direction, progress: 0 };
    // 저스트 회피 직후의 첫 공격은 반격이다.
    const counter = time <= this.counterUntil;
    if (counter) this.counterUntil = 0;
    this.attackTrace = { startedAt: time, stage, direction, previous: hero.getBlade(), elapsed: 0, hit: new Set(), counter };
  }

  /** 전진 진행도의 차이를 적용해 프레임 속도와 관계없이 같은 거리를 이동한다. */
  private updateAttackLunge(time: number): void {
    const lunge = this.attackLunge;
    if (!lunge) return;
    if (!this.player.alive || !this.player.isAttacking) {
      this.attackLunge = undefined;
      return;
    }
    const combo = PLAYER.combo[lunge.stage];
    const progress = lungeProgress(time - lunge.startedAt, combo.lungeStartMs, combo.lungeEndMs);
    const distance = (progress - lunge.progress) * combo.lungeDistance;
    lunge.progress = progress;
    const next = this.walkArea.move(this.player.x, this.player.y,
      distance * lunge.direction.x, distance * lunge.direction.y * VERTICAL_SPEED_RATIO, this.scratch);
    this.player.placeAt(next.x, next.y);
    if (progress === 1) this.attackLunge = undefined;
  }

  /** 시각 효과와 명중 판정이 같은 검날 좌표를 사용한다. 적마다 한 공격에 한 번만 맞는다. */
  private updateAttackTrace(time: number): void {
    const trace = this.attackTrace;
    const player = this.player;
    const rig = player.sprite;
    if (!trace) return;
    if (!player.alive || !player.isAttacking || !(rig instanceof HeroSprite)) {
      this.attackTrace = undefined;
      return;
    }
    const combo = PLAYER.combo[trace.stage];
    const elapsed = time - trace.startedAt;
    const current = rig.getBlade();
    const previous = trace.previous;
    trace.previous = current;
    const lastElapsed = trace.elapsed;
    trace.elapsed = elapsed;
    const end = combo.hitDelayMs + PLAYER.hitWindowMs;
    // 휘두르는 그림이 나타나는 순간, 직전 자세의 칼에서 지금 칼까지 초승달 궤적을 그린다.
    const strikeAt = strikePoseStart(trace.stage);
    if (lastElapsed < strikeAt && elapsed >= strikeAt) {
      trace.effect ??= this.effects.beginAttack(trace.stage, trace.startedAt + end, combo.hitDelayMs, player.y + 2);
      this.effects.slash(trace.effect, previous, current, time, trace.direction.x);
    }
    const sweep = clipBladeSweep(previous, current, lastElapsed, elapsed, combo.hitDelayMs, end);
    if (elapsed >= end) this.attackTrace = undefined;
    if (!sweep) return;
    const finisher = trace.stage === PLAYER.combo.length - 1;
    trace.effect ??= this.effects.beginAttack(trace.stage, trace.startedAt + end, combo.hitDelayMs, player.y + 2);
    this.effects.drawAttack(trace.effect, sweep, time);

    let heaviest: Exclude<HitKind, 'hurt'> | undefined;
    for (const enemy of this.enemies) {
      const c = enemy.character;
      if (!c.alive || trace.hit.has(enemy)) continue;
      // Use a corridor around the locked attack direction, then test the visible blade.
      if (!insideAttackLane(c.x - player.x, c.y - player.y, trace.direction,
        PLAYER.attackLane, VERTICAL_SPEED_RATIO)) continue;
      const bounds = c.sprite.getBounds(this.boundsScratch);
      if (!bladeHitsEllipse(sweep.previous, sweep.current, { x: bounds.centerX, y: bounds.centerY },
        bounds.width * 0.42 + PLAYER.bladeRadius, bounds.height * 0.42 + PLAYER.bladeRadius)) continue;
      trace.hit.add(enemy);

      // 행운(LUK)만큼 치명타 확률이 오른다: 굴린 값을 그만큼 낮춘다.
      const strike = strikeKind(trace.counter, finisher, Math.random() - (this.derived.critChance - HIT_FEEL.critChance));
      heaviest = heavierKind(heaviest, strike.kind);
      const bonus = trace.counter ? JUST_DODGE.counterDamage : 1;
      const damage = Math.round(Phaser.Math.Between(this.stats.damageMin, this.stats.damageMax) * combo.damage * bonus * critMultiplier(strike.crit));
      const died = c.hurt(damage);
      if (trace.counter) this.showDamage(c.x, c.y - 100, damage, '#9fdcff', 50);
      else if (strike.crit) this.showDamage(c.x, c.y - 100, damage, '#ffd23f', finisher ? 58 : 52);
      else this.showDamage(c.x, c.y - 100, damage, finisher ? '#ffb35a' : '#fff3c4', finisher ? 46 : 34);
      // 칼이 닿은 자리(몸 가운데)에서 섬광과 불꽃이 튄다.
      this.impacts.impact(bounds.centerX, bounds.centerY, trace.direction.x, trace.direction.y,
        strike.crit && strike.kind === 'finisher' ? 'finisher' : strike.kind, this.now, c.y);
      // 검으로 벨 때마다 마나가 조금 찬다.
      this.mp = addMana(this.mp, this.maxMp, MANA.perHit);
      const heavy = strike.kind !== 'normal' ? HIT_FEEL.heavyKnockback : 1;
      this.resolveEnemyHit(enemy, died, trace.direction.x, trace.direction.y, PLAYER.knockback * combo.knockback * heavy);
    }
    if (heaviest) {
      const [ms, intensity] = HIT_FEEL.shake[heaviest];
      this.cameras.main.shake(ms, intensity);
      this.hitStop(heaviest);
      if (heaviest === 'counter') this.impacts.screenFlash(0x9fdcff, 0.16);
      else if (heaviest !== 'normal') this.impacts.screenFlash(0xffffff, heaviest === 'finisher' ? 0.1 : 0.07);
    }
  }

  /** 맞은 적의 뒤처리: 쓰러졌으면 경험치·퀘스트·전리품, 아니면 밀려나고 움찔한다. */
  private resolveEnemyHit(enemy: Enemy, died: boolean, dirX: number, dirY: number, push: number): void {
    const c = enemy.character;
    if (died) {
      enemy.kill();
      this.impacts.splatter(c.x, c.y, enemy.color, this.now);
      const raid = this.raidEnemies.has(enemy);
      if (!raid) this.enemyRespawns.push({ at: this.now + ENEMY.respawnMs, enemy });
      this.gainXp(enemy.stats.xp, c.x, c.y - 185);
      this.questEvent({ type: 'kill', map: this.mapId, monster: enemy.kind, ...(raid ? { encounter: 'village-raid' as const } : {}) });
      if (!raid) this.collectDrop(c.x, c.y, enemy);
    } else {
      c.knockback.set(dirX * push, dirY * push * VERTICAL_SPEED_RATIO);
      enemy.interrupt(this.now);
      enemy.onHit(this.now);
    }
  }

  /** 경험치를 더하고, 레벨이 오르면 능력치를 올리고 체력을 가득 채운다. */
  private gainXp(amount: number, x: number, y: number): void {
    const result = addXp(this.progress, amount);
    this.progress = { level: result.level, xp: result.xp };
    saveProgress(this.storage, this.progress);
    if (amount > 0) this.progressEffects.showXp(x, y, amount);

    if (result.levelsGained > 0) {
      const player = this.player;
      this.recomputeStats();
      if (this.herb) this.herb = herbBonus(this.stats.maxHp);
      player.setMaxHp(this.stats.maxHp + this.herb, player.alive);
      this.mp = this.maxMp;
      this.hud.showCallout(`능력치 포인트 +${pointsLeft(result.level, this.character.alloc)} · 상태창에서 올려 보세요`);
      player.setLevel(result.level);
      this.hud.showLevelUp(result.level);
      this.progressEffects.levelUpBurst(player.x, player.y);
    }
    this.drawHud();
  }

  // ---------------------------------------------------------------- 일시정지·설정

  private buildPause(): void {
    this.settings = loadSettings(this.storage);
    this.pauseButton = new ActionButton(this, { x: 0, y: 0, radius: 30, label: 'II', color: 0x2a2018, fontSize: 22 });
    this.pauseMenu = new PauseMenu(this, {
      settings: this.settings,
      onResume: () => this.onResume(),
      onSettingsChange: (settings) => {
        this.applySettings(settings);
        saveSettings(this.storage, settings);
      },
      canExit: Capacitor.isNativePlatform(),
      // 게임 종료: 앱 화면만 닫으면(finish) 같은 프로세스에 이전 게임(그림·WebGL·게임 루프)이 남아,
      // 다시 켰을 때 두 게임 몫의 메모리로 버벅인다. 먼저 Phaser 게임을 완전히 정리하고 앱을 닫는다.
      onExit: () => window.setTimeout(() => {
        this.game.destroy(true);
        void App.exitApp();
      }, 0),
      stressLabel: () => `성능 테스트: ${this.stressCount ? `${this.stressCount}명` : '끔'}`,
      // 마을에서 사람 수를 바꿔 다시 시작한다. 끔 → 50 → 100 → 200 → 끔.
      onStress: () => this.scene.restart({ map: 'village', stress: nextStressCount(this.stressCount) }),
      onBag: () => this.openCharacterPanel('items'),
    });
    this.pauseKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)] : [];
    // 안드로이드 뒤로가기: 바로 앱을 끄지 않고 일시정지 메뉴를 연다 (웹에서는 아무 일도 없다).
    try {
      this.backButtonListener = App.addListener('backButton', () => this.onBackButton());
      this.backButtonListener.catch(() => undefined);
    } catch {
      this.backButtonListener = undefined;
    }
    this.applySettings(this.settings);
  }

  private applySettings(settings: Settings): void {
    this.settings = settings;
    const buttons = sizeScale(settings.buttonSize);
    this.attackButton.setSizeScale(buttons);
    this.dodgeButton.setSizeScale(buttons);
    this.blockButton?.setSizeScale(buttons);
    this.talkButton.setSizeScale(buttons);
    this.potionButton?.setSizeScale(buttons);
    this.lunchButton?.setSizeScale(buttons);
    this.skillButton?.setSizeScale(buttons);
    this.joystick.setSizeScale(sizeScale(settings.joystickSize));
    this.justDodgeWindow = justDodgeWindowMs(settings.justDodgeTiming);
    if (this.pauseMenu) this.layout();
  }

  /** 뒤로가기 버튼: 메뉴가 열려 있으면 한 단계 뒤로, 아니면 일시정지. */
  private onBackButton(): void {
    if (this.quickSlotPanel?.isOpen) { this.quickSlotPanel.close(); return; }
    if (this.storyChoice?.isOpen) { this.storyChoice.cancel(); return; }
    if (this.pauseMenu.isOpen) this.pauseMenu.back();
    else this.openPause();
  }

  private openPause(): void {
    if (this.storyChoice?.isOpen || this.quickSlotPanel?.isOpen) return;
    if (!this.pauseMenu || this.pauseMenu.isOpen) return;
    this.pauseButton.setVisible(false);
    this.characterButton?.setVisible(false);
    this.setQuickButtonsVisible(false);
    this.pauseMenu.open();
  }

  /** 메뉴를 닫을 때 메뉴를 누르던 입력이 공격·회피·대화로 이어지지 않게 비운다. */
  private onResume(): void {
    this.pauseButton.setVisible(true);
    this.characterButton?.setVisible(true);
    this.characterButton?.consumePress();
    this.clearAttackInput();
    this.dodgeButton.consumePress();
    this.talkButton.consumePress();
    this.pauseButton.consumePress();
    this.clearQuickItemInput();
    for (const key of [...this.dodgeKeys, ...this.talkKeys, ...this.attackKeys, ...this.mapKeys]) Phaser.Input.Keyboard.JustDown(key);
  }

  // ---------------------------------------------------------------- 대화

  /** 대화 버튼이나 E·Enter 키를 이번 프레임에 눌렀는지. 눌림은 한 번만 센다. */
  private talkPressed(): boolean {
    let pressed = this.talkButton.consumePress();
    for (const key of this.talkKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    }
    return pressed;
  }

  private onDialoguePointer(): void {
    if (this.dialogue.isOpen && !this.pauseMenu.isOpen) this.dialogue.advance();
  }

  /** 싸우는 중에는 말을 걸 수 없다. 대화 중에는 게임이 멈추므로 공격받는 도중에 열리지 않게 한다. */
  private inCombat(): boolean {
    return this.enemies.some((e) => e.state === 'chase' || e.state === 'windup' || e.state === 'recover');
  }

  /** 가까이 있는 대상을 찾아 말풍선과 대화 버튼을 보여 주고, 누르면 대화를 연다. */
  private updateInteraction(time: number): void {
    const player = this.player;
    const free = player.alive && !player.isAttacking && this.dodgeProgress >= 1 && !this.inCombat();
    const target = free ? findInteractable(player.x, player.y, this.interactables) : undefined;
    this.talkButton.setVisible(!!target);

    const marker = this.talkMarker;
    if (!target) {
      marker.setVisible(false);
      this.talkPressed(); // 대상이 없을 때 누른 키는 버린다
      return;
    }
    marker.setVisible(true).setPosition(target.x, target.y - target.markerHeight - 6 * Math.abs(Math.sin(time / 260)));
    // 건물 문 앞에서는 "들어가기", 그 밖에는 "대화"
    const enter = target.enter;
    // 실내에서 바깥으로 나가는 문은 "나가기"
    const leaving = enter && !enter.to.startsWith('in-');
    this.talkButton.setLabel(leaving ? '나가기' : enter ? '들어가기' : target.id.startsWith('story-') ? '살펴보기' : target.id.startsWith('rest-') ? '쉬기' : target.id.startsWith('heal-') ? '치료받기' : '대화');
    marker.setText(leaving ? '▼ 나가기' : enter ? `▲ ${enter.label}` : '···');

    if (!this.talkPressed()) return;
    if (enter && isMapId(enter.to)) {
      this.hud.dismissHint();
      this.travel({ to: enter.to, arrive: enter.at, zone: { left: 0, top: 0, right: 0, bottom: 0 }, label: '', labelAt: enter.at });
    } else {
      this.openDialogue(target);
    }
  }

  private openDialogue(target: Interactable, confirmed = false): void {
    if (this.storyChoice?.isOpen) return;
    const festival = this.quests['festival-eve'];
    if (!confirmed && target.id === 'npc-rosetta' && festival?.status === 'active') {
      this.clearAttackInput();
      this.storyChoice?.open(() => this.openDialogue(target, true));
      return;
    }
    if (target.id === HOME_BED_SPOT.id) {
      this.clearAttackInput();
      this.rest('home');
      return;
    }
    if (target.id === CLINIC_BED_SPOT.id) {
      this.clearAttackInput();
      this.healAtClinic();
      return;
    }
    if (target.id.startsWith('story-')) {
      this.dialogue.open(INSPECTION_LINES[target.id] ?? [], () => {
        const spot = target.id === 'story-south-watch' ? 'south-watch' : 'home-search';
        this.questEvent({ type: 'inspect', spot, map: this.mapId });
        this.onResume();
      });
      return;
    }
    const beforePhase = chapterPhase(this.quests);
    const player = this.player;
    this.hud.dismissHint();
    this.clearAttackInput();
    player.setMotion(false, target.x - player.x);
    this.talkButton.setVisible(false);
    this.talkMarker.setVisible(false);
    // 마을 사람이면 퀘스트 대화를 먼저 본다. 퀘스트와 상관없으면 평소 대사.
    const quest = target.id.startsWith('npc-') ? talkTo(target.id.slice(4) as NpcId, this.quests) : undefined;
    const npc = target.id.startsWith('npc-') ? target.id.slice(4) as NpcId : undefined;
    const lines = quest?.lines.length ? quest.lines : (npc && chapterDialogue(npc, this.quests)) || (target.dialogue ? DIALOGUES[target.dialogue] : []);
    this.dialogue.open(lines, () => {
      if (quest) {
        this.quests = quest.state;
        this.saveQuests();
        this.refreshQuests();
      }
      if (quest?.completed) {
        this.hud.showCallout(`퀘스트 완료: ${quest.completed.title}${quest.next ? ` → ${quest.next.title}` : ''}`);
        this.gainXp(quest.completed.rewardXp, player.x, player.y - 185);
        this.giveRewards(quest.completed.rewardGold ?? 0, quest.completed.rewardItems ?? []);
      } else if (quest?.accepted) {
        this.hud.showCallout(`새 퀘스트: ${quest.accepted.title}`);
      } else if (quest?.progressed) {
        const p = this.quests[quest.progressed.id]!;
        this.hud.showCallout(`${quest.progressed.title}: ${p.status === 'ready' ? '보고하러 가기' : currentObjective(quest.progressed, p).label}`);
      }
      // 메리나와의 평소 대화가 끝나면 잡화점을 연다.
      if (!quest && target.id === 'npc-merina') this.openItemPanel('shop');
      // 도란과 대화가 끝나면 대장간(장비 구매·판매)을 연다. 퀘스트를 막 받거나 끝낸 대화 뒤에는 열지 않는다
      // (진행 중인 퀘스트를 다시 일러 주는 대화 뒤에는 연다. 그러지 않으면 퀘스트 동안 장비를 못 산다).
      if (!quest?.accepted && !quest?.completed && target.id === 'npc-doran') this.openCharacterPanel('items', true);
      // 로제타와의 평소 대화가 끝나면 쉬어 갈지 묻는다 (습격의 밤에는 묻지 않는다).
      // 치유소의 에일라와 평소 대화가 끝나면 치료해 줄지 묻는다.
      if (!quest && target.id === 'npc-eila' && this.mapId === 'in-clinic') {
        this.storyChoice?.open(() => this.healAtClinic(), {
          text: '다친 데가 있으면 봐 줄게.\n체력과 마나가 모두 차고,\n약초 기운이 처음 맞을 때까지 남아.',
          yes: '치료받기 [Enter]', no: '괜찮아요 [Esc]',
        });
      }
      if (!quest && target.id === 'npc-rosetta' && canRest(this.quests)) {
        this.storyChoice?.open(() => this.rest('inn'), {
          title: '여관에서 쉬어 가기',
          text: '로제타가 준비한 방에서 잠시 쉬어 가세요.',
          summary: `체력 회복  ·  ${this.player.hp} / ${this.player.maxHp} → ${this.player.maxHp} / ${this.player.maxHp}\n다음 시작 위치  ·  로웬 마을 여관`,
          hint: '휴식은 무료이며 퀘스트 진행과 시간대는 바뀌지 않습니다.',
          yes: '쉬어 가기', no: '돌아가기',
        });
      }
      // 대화를 넘기려고 누른 공격 키가 닫힌 뒤 공격으로 이어지지 않게 한다.
      this.clearAttackInput();
      this.dodgeButton.consumePress();
      this.clearQuickItemInput();
      for (const key of this.dodgeKeys) Phaser.Input.Keyboard.JustDown(key);
      if (beforePhase !== chapterPhase(this.quests)) {
        const at = { x: 1180, y: 1130 };
        this.travel({ to: 'village', arrive: at, zone: { left: 0, top: 0, right: 0, bottom: 0 }, label: '', labelAt: at });
      }
    });
  }

  /** 쉬기: 체력을 채우고 다음 시작 자리로 저장한다. */
  private rest(id: RestPointId): void {
    if (!canRest(this.quests)) {
      this.hud.showCallout('지금은 쉴 때가 아니야');
      return;
    }
    this.player.setMaxHp(this.player.maxHp, true);
    this.mp = this.maxMp;
    this.drawHud();
    try {
      this.storage?.setItem(REST_SAVE_KEY, serializeRestPoint(id));
    } catch {
      // 저장소를 쓸 수 없으면 쉬기만 한다.
    }
    this.hud.showCallout(`푹 쉬었다 · 다음에는 ${REST_POINTS[id].name}에서 시작한다`);
  }

  /**
   * 치유소 침대: 체력을 채우고 둔화를 풀고, 약초 기운(최대 체력 보너스)을 준다.
   * 약초 기운은 처음 맞을 때까지 이어진다. 다시 시작할 자리는 저장하지 않는다.
   */
  private healAtClinic(): void {
    this.herb = herbBonus(this.stats.maxHp);
    this.player.setMaxHp(this.stats.maxHp + this.herb, true);
    this.mp = this.maxMp;
    this.slowedUntil = 0;
    this.drawHud();
    this.hud.showCallout(`치료를 받았다 · 약초 기운으로 최대 체력 +${this.herb} (맞기 전까지)`);
  }

  private loadRestPoint() {
    try {
      return parseRestPoint(browserStorage()?.getItem(REST_SAVE_KEY) ?? null);
    } catch {
      return undefined;
    }
  }

  // ---------------------------------------------------------------- 퀘스트와 미니맵

  /** 처치·마무리 일격처럼 퀘스트 목표를 채우는 일이 일어났을 때 */
  private questEvent(event: QuestEvent): void {
    const { state, updates } = recordEvent(this.quests, event);
    if (updates.length === 0) return;
    this.quests = state;
    this.saveQuests();
    this.refreshQuests();
    const u = updates[0];
    this.hud.showCallout(u.ready ? `${u.quest.title} 목표 달성!` : `${u.quest.title} ${u.count}/${u.need}`);
  }

  /** 머리 위 표시와 퀘스트 목록을 지금 상태로 맞춘다. */
  private refreshQuests(): void {
    this.interactables = this.interactables.filter(spot => !spot.id.startsWith('story-'));
    for (const marker of this.storyMarkers) marker.destroy();
    this.storyMarkers = [];
    for (const spot of chapterSpots(this.quests, this.mapId)) {
      this.interactables.push(spot);
      this.storyMarkers.push(this.add.text(spot.x, spot.y - spot.markerHeight, '◆ 살펴보기', {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffd23f', stroke: '#1a1008', strokeThickness: 5,
      }).setOrigin(0.5, 1).setDepth(spot.y + 400).setResolution(2));
    }
    for (const npc of this.npcs) npc.setQuestMarker(markerFor(npc.def.id, this.quests));
    for (const door of this.doorMarkers) {
      const markers = door.npcs.map((id) => markerFor(id, this.quests)).filter((m): m is QuestMarker => !!m);
      door.marker = MARKER_PRIORITY.find((m) => markers.includes(m));
      if (door.marker) door.text.setText(MARKER_STYLE[door.marker].text).setColor(MARKER_STYLE[door.marker].color);
      door.text.setVisible(!!door.marker);
    }
    this.questTracker?.refresh(this.quests);
  }

  private loadQuests(): QuestState {
    try {
      return parseQuests(this.storage?.getItem(QUEST_SAVE_KEY) ?? null);
    } catch {
      return {};
    }
  }

  private saveQuests(): void {
    try {
      this.storage?.setItem(QUEST_SAVE_KEY, serializeQuests(this.quests));
    } catch {
      // 저장소가 막혀 있으면 이번 실행 동안만 기억한다.
    }
  }

  // ---------------------------------------------------------------- 골드와 아이템

  // ---------------------------------------------------------------- 마나와 회전 베기

  /** 마나가 저절로 차고, 스킬 버튼(또는 K)으로 회전 베기를 쓴다. 맞히는 순간도 여기서 처리한다. */
  private updateSkill(time: number, gameStep: number): void {
    const player = this.player;
    if (player.alive) this.mp = regenMana(this.mp, this.maxMp, gameStep);
    if (this.spinHitAt !== undefined && time >= this.spinHitAt) {
      this.spinHitAt = undefined;
      if (player.alive) this.spinHit();
    }
    const button = this.skillButton;
    let pressed = button?.consumePress() ?? false;
    for (const key of this.skillKeys) if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    const ready = player.alive && time >= this.nextSpinAt && !player.isAttacking && time >= this.dodgeUntil
      && this.spinHitAt === undefined;
    const enough = this.mp >= SPIN_SLASH.cost;
    button?.setEnabled(ready && enough);
    if (pressed) {
      if (ready && enough) this.startSpin(time);
      else if (ready) this.hud.showCallout('마나가 부족하다');
    }
    this.drawMp();
  }

  /** 회전 베기를 시작한다: 마나를 쓰고 세 번째 콤보 자세를 취한다. 제자리에서 돈다. */
  private startSpin(time: number): void {
    const player = this.player;
    const hero = player.sprite;
    this.mp -= SPIN_SLASH.cost;
    this.dismissHint();
    this.attackTrace = undefined;
    this.attackLunge = undefined;
    this.comboStage = 0;
    const finisher = PLAYER.combo[PLAYER.combo.length - 1];
    this.nextAttackAt = time + finisher.intervalMs;
    this.nextSpinAt = time + SPIN_SLASH.cooldownMs;
    this.spinHitAt = time + SPIN_SLASH.hitDelayMs;
    if (hero instanceof HeroSprite) hero.setAttackFacing(attackFacingFor(hero.lookDirection, player.facing));
    player.playAttack(PLAYER.combo.length);
    this.impacts.dust(player.x, player.y, 6, time, SPIN_SLASH.radius * 0.4);
    this.drawMp(true);
  }

  /** 회전 베기가 맞는 순간: 둘레(지면 타원) 안의 모든 적을 한 번씩 벤다. */
  private spinHit(): void {
    const player = this.player;
    const now = this.now;
    let hits = 0;
    for (const enemy of this.enemies) {
      const c = enemy.character;
      if (!c.alive) continue;
      const dx = c.x - player.x, dy = c.y - player.y;
      if (!inSpinRadius(dx, dy, SPIN_SLASH.radius, VERTICAL_SPEED_RATIO)) continue;
      hits++;
      const length = Math.hypot(dx, dy / VERTICAL_SPEED_RATIO) || 1;
      const dirX = dx / length, dirY = dy / VERTICAL_SPEED_RATIO / length;
      const damage = Math.round(Phaser.Math.Between(this.stats.damageMin, this.stats.damageMax) * SPIN_SLASH.damage * this.derived.skillDamage);
      const died = c.hurt(damage);
      this.showDamage(c.x, c.y - 100, damage, '#8fc8ff', 46);
      const bounds = c.sprite.getBounds(this.boundsScratch);
      this.impacts.impact(bounds.centerX, bounds.centerY, dirX, dirY, 'finisher', now, c.y);
      this.resolveEnemyHit(enemy, died, dirX, dirY, PLAYER.knockback * SPIN_SLASH.knockback);
    }
    // 빈 곳을 베어도 둘레에 바람과 먼지가 인다.
    this.impacts.dust(player.x, player.y, 10, now, SPIN_SLASH.radius * 0.8);
    this.impacts.screenFlash(0x8fc8ff, hits ? 0.14 : 0.06);
    if (hits) {
      const [ms, intensity] = HIT_FEEL.shake.finisher;
      this.cameras.main.shake(ms, intensity);
      this.hitStop('finisher');
    }
  }

  /** 각 버튼은 해당 아이템만 사용한다. 두 슬롯은 20초 대기 시간을 공유한다. */
  private updatePotion(time: number): void {
    this.updateItemButton(time, 0, this.potionButton, this.potionKeys);
    this.updateItemButton(time, 1, this.lunchButton, this.lunchKeys);
  }

  private updateItemButton(time: number, slot: 0 | 1, button: ActionButton | undefined, keys: Phaser.Input.Keyboard.Key[]): void {
    if (!button || this.quickSlotPanel?.isOpen) return;
    const id = this.quickSlots[slot];
    let pressed = button.consumePress();
    for (const key of keys) if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    const player = this.player;
    const ready = time >= this.nextUseAt && player.alive && player.hp < player.maxHp && !!id && countOf(this.inventory, id) > 0;
    button.setEnabled(!id || ready);
    button.setCooldown(id ? Math.max(0, this.nextUseAt - time) : 0, USE_COOLDOWN_MS);
    if (pressed && !id) this.openQuickSlot(slot);
    else if (pressed && ready && id) this.useHealItem(id);
  }

  private openQuickSlot(slot: 0 | 1): void {
    if (this.traveling || !this.player.alive || this.dialogue.isOpen || this.pauseMenu.isOpen
      || this.itemPanel?.isOpen || this.worldMap?.isOpen || this.storyChoice?.isOpen || this.characterPanel?.isOpen) return;
    this.clearQuickItemInput();
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.setQuickButtonsVisible(false);
    this.quickSlotPanel?.show(slot, this.inventory, this.quickSlots);
  }

  private setQuickButtonsVisible(visible: boolean): void {
    this.potionButton?.setVisible(visible);
    this.lunchButton?.setVisible(visible);
  }

  private clearQuickItemInput(): void {
    this.potionButton?.consumePress();
    this.lunchButton?.consumePress();
    for (const key of this.potionKeys) Phaser.Input.Keyboard.JustDown(key);
    for (const key of this.lunchKeys) Phaser.Input.Keyboard.JustDown(key);
  }

  private useHealItem(id: ItemId): boolean {
    const player = this.player;
    const result = useItem(this.inventory, id, player.hp, player.maxHp);
    if (!result || this.now < this.nextUseAt) return false;
    this.inventory = result.inventory;
    this.nextUseAt = this.now + USE_COOLDOWN_MS;
    player.hp += result.heal;
    this.showDamage(player.x, player.y - 190, result.heal, '#7dff8a', 38);
    this.impacts.dust(player.x, player.y, 3, this.now, 30);
    this.drawHud();
    this.saveInventory();
    this.refreshInventory();
    return true;
  }

  /** 몬스터 보상을 바로 줍는다. 점액은 슬라임만 떨어뜨린다. */
  private collectDrop(x: number, y: number, enemy: Enemy): void {
    const rolled = enemy.kind === 'slime' ? slimeDrop(Math.random) : { gold: Phaser.Math.Between(5, 9), items: [] };
    // 행운(LUK)만큼 골드를 더 줍는다.
    const drop = { ...rolled, gold: Math.round(rolled.gold * this.derived.goldGain) };
    this.inventory = applyDrop(this.inventory, drop);
    this.progressEffects.showPopup(x, y - 150, `+${drop.gold} G`, '#ffd23f');
    drop.items.forEach((item, i) => this.progressEffects.showPopup(x, y - 120 + i * 26, `${ITEMS[item.id].name} +${item.count}`, '#a8f0ff'));
    this.saveInventory();
    this.refreshInventory();
  }

  private giveRewards(gold: number, items: Array<{ id: ItemId; count: number }>): void {
    if (gold === 0 && items.length === 0) return;
    this.inventory = addGold(this.inventory, gold);
    for (const item of items) this.inventory = addItem(this.inventory, item.id, item.count);
    const player = this.player;
    const labels = [gold ? `+${gold} G` : '', ...items.map((i) => `${ITEMS[i.id].name} +${i.count}`)].filter(Boolean);
    labels.forEach((label, i) => this.progressEffects.showPopup(player.x, player.y - 150 + i * 28, label, i === 0 && gold ? '#ffd23f' : '#a8f0ff'));
    this.saveInventory();
    this.refreshInventory();
  }

  /** 전체 지도를 연다. 대화·메뉴·이동 중에는 열지 않는다. */
  private openWorldMap(): void {
    if (!this.worldMap || this.quickSlotPanel?.isOpen || this.storyChoice?.isOpen || this.worldMap.isOpen || this.dialogue.isOpen || this.pauseMenu.isOpen || this.itemPanel?.isOpen || this.characterPanel?.isOpen || this.traveling) return;
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.talkButton.setVisible(false);
    this.talkMarker.setVisible(false);
    this.pauseButton.setVisible(false);
    this.characterButton?.setVisible(false);
    // 지도에는 퀘스트 표시(!/?)를 띄우지 않는다. 퀘스트는 머리 위·미니맵·추적창으로 안내한다.
    this.exitHint?.update(this.player, true, false);
    this.setQuickButtonsVisible(false);
    this.worldMap.show(this.player, { npcs: this.npcs.map(n => ({ x: n.x, y: n.y })),
      enemies: this.enemies.filter(e => e.character.alive).map(e => ({ x: e.character.x, y: e.character.y })) },
      chapterPhase(this.quests) === 'raid' && this.mapId === 'village');
  }

  private loadVisited(): Set<RegionId> {
    try {
      return parseVisited(this.storage?.getItem(VISITED_SAVE_KEY) ?? null);
    } catch {
      return new Set();
    }
  }

  private saveVisited(): void {
    try {
      this.storage?.setItem(VISITED_SAVE_KEY, serializeVisited(this.visited));
    } catch {
      // 저장소가 막혀 있으면 이번 실행 동안만 기억한다.
    }
  }

  // ---------------------------------------------------------------- 능력치와 장비

  /** 레벨·분배한 능력치·장비로 전투 수치를 다시 계산한다. */
  private recomputeStats(): void {
    const stats = totalStats(this.character.alloc, gearBonus(this.character.gear));
    this.derived = deriveStats(this.progress.level, stats);
    this.stats = { maxHp: this.derived.maxHp, damageMin: this.derived.damageMin, damageMax: this.derived.damageMax };
    this.maxMp = this.derived.maxMp;
  }

  /** 능력치나 장비가 바뀐 뒤: 최대 체력·마나를 맞추고(늘어난 만큼 채운다) 저장한다. */
  private applyCharacterChange(): void {
    const player = this.player;
    const beforeHp = player?.maxHp ?? 0, beforeMp = this.maxMp;
    this.recomputeStats();
    if (player) {
      const max = this.stats.maxHp + this.herb;
      player.setMaxHp(max, false);
      if (max > beforeHp && player.alive) player.hp = Math.min(max, player.hp + (max - beforeHp));
    }
    if (this.maxMp > beforeMp) this.mp = Math.min(this.maxMp, this.mp + (this.maxMp - beforeMp));
    this.mp = Math.min(this.mp, this.maxMp);
    this.saveCharacter();
    this.drawHud();
    this.characterPanel?.refresh(this.characterView());
  }

  private allocateStat(stat: StatId): void {
    const next = allocate(this.character.alloc, stat, this.progress.level);
    if (!next) {
      this.characterPanel?.setStatus('남은 포인트가 없어요. 레벨이 오르면 받을 수 있어요.', true);
      return;
    }
    this.character = { ...this.character, alloc: next };
    this.applyCharacterChange();
    this.characterPanel?.setStatus(`능력치를 올렸어요 · 남은 포인트 ${pointsLeft(this.progress.level, next)}`);
  }

  private changeGear(next: CharacterData['gear'] | null, message: string): void {
    if (!next) {
      this.characterPanel?.setStatus('이 칸에는 낄 수 없어요.', true);
      return;
    }
    this.character = { ...this.character, gear: next };
    this.applyCharacterChange();
    this.characterPanel?.setStatus(message);
  }

  private tradeGear(id: GearId, type: 'buy' | 'sell'): void {
    const result = type === 'buy' ? buyGear(this.inventory, this.character.gear, id) : sellGear(this.inventory, this.character.gear, id);
    if (!result) {
      this.characterPanel?.setStatus('거래할 수 없어요. 골드와 보유 수량을 확인해 주세요.', true);
      return;
    }
    this.inventory = result.inventory;
    this.character = { ...this.character, gear: result.gear };
    this.saveInventory();
    this.refreshInventory();
    this.saveCharacter();
    this.characterPanel?.refresh(this.characterView());
    const def = GEAR[id];
    this.characterPanel?.setStatus(type === 'buy' ? `${def.name} 구매 · −${def.price} G · 장비 탭에서 낄 수 있어요` : `${def.name} 판매 · +${def.sellPrice} G`);
  }

  private characterView(): CharacterView {
    const bonus = gearBonus(this.character.gear);
    return {
      name: HERO_NAME,
      level: this.progress.level,
      hp: this.player?.hp ?? this.stats.maxHp,
      mp: this.mp,
      pointsLeft: pointsLeft(this.progress.level, this.character.alloc),
      stats: totalStats(this.character.alloc, bonus),
      bonus,
      derived: { ...this.derived, maxHp: this.player?.maxHp ?? this.derived.maxHp },
      inventory: this.inventory,
      gear: this.character.gear,
    };
  }

  /** 캐릭터 창을 연다. smithy면 도란의 대장간(장비 구매·판매). 대화·메뉴·이동 중에는 열지 않는다. */
  private openCharacterPanel(tab: CharacterTab, smithy = false): void {
    if (!this.characterPanel || this.characterPanel.isOpen || this.traveling || this.pauseMenu.isOpen || this.dialogue.isOpen
      || this.itemPanel?.isOpen || this.worldMap?.isOpen || this.storyChoice?.isOpen || this.quickSlotPanel?.isOpen) return;
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.talkButton.setVisible(false);
    this.talkMarker.setVisible(false);
    this.pauseButton.setVisible(false);
    this.characterButton?.setVisible(false);
    this.setQuickButtonsVisible(false);
    if (smithy) this.characterPanel.showSmithy(this.characterView());
    else this.characterPanel.show(tab, this.characterView());
  }

  private loadCharacter(): CharacterData {
    try {
      return parseCharacter(this.storage?.getItem(CHARACTER_SAVE_KEY) ?? null, this.progress.level);
    } catch {
      return newCharacter();
    }
  }

  private saveCharacter(): void {
    try {
      this.storage?.setItem(CHARACTER_SAVE_KEY, serializeCharacter(this.character));
    } catch {
      // 저장소가 막혀 있으면 이번 실행 동안만 기억한다.
    }
  }

  private openItemPanel(mode: 'bag' | 'shop'): void {
    this.setQuickButtonsVisible(false);
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.talkButton.setVisible(false);
    this.talkMarker.setVisible(false);
    this.pauseButton.setVisible(false);
    this.characterButton?.setVisible(false);
    this.itemPanel?.show(mode, this.inventory);
  }

  private onItemAction(action: PanelAction): void {
    let next: Inventory | null = null;
    if (action.type === 'use') {
      if (this.now < this.nextUseAt) {
        const message = `재사용까지 ${Math.ceil((this.nextUseAt - this.now) / 1000)}초 · 창을 닫으면 시간이 흐릅니다.`;
        this.itemPanel?.setStatus(message, true);
        this.characterPanel?.setStatus(message, true);
        return;
      }
      const before = this.player.hp;
      const used = this.useHealItem(action.id);
      this.itemPanel?.setStatus(used ? `${ITEMS[action.id].name} 사용 · 체력 +${this.player.hp - before}`
        : this.player.hp >= this.player.maxHp ? '체력이 가득 차 있어요. 물품은 사용하지 않았습니다.' : '지금은 이 물품을 사용할 수 없어요.', !used);
      this.itemPanel?.refresh(this.inventory);
      if (this.characterPanel?.isOpen) {
        this.characterPanel.setStatus(used ? `${ITEMS[action.id].name} 사용 · 체력 +${this.player.hp - before}`
          : this.player.hp >= this.player.maxHp ? '체력이 가득 차 있어요.' : '지금은 사용할 수 없어요.', !used);
        this.characterPanel.refresh(this.characterView());
      }
      return;
    }
    if (action.type === 'buy') next = buy(this.inventory, action.id);
    if (action.type === 'sell') next = sell(this.inventory, action.id);
    if (!next) {
      this.itemPanel?.setStatus('거래할 수 없어요. 골드와 보유 수량을 확인해 주세요.', true);
      return;
    }
    this.inventory = next;
    this.saveInventory();
    this.refreshInventory();
    this.itemPanel?.refresh(this.inventory);
    const item = ITEMS[action.id];
    this.itemPanel?.setStatus(action.type === 'buy'
      ? `${item.name} 1개 구매 · −${item.price} G`
      : `${item.name} 1개 판매 · +${item.sellPrice} G`);
  }

  /** HUD의 골드와 물약 버튼 숫자를 맞춘다. */
  private refreshInventory(): void {
    this.hud.setGold(this.inventory.gold);
    this.refreshQuickButton(0, this.potionButton);
    this.refreshQuickButton(1, this.lunchButton);
  }

  private refreshQuickButton(slot: 0 | 1, button: ActionButton | undefined): void {
    const id = this.quickSlots[slot];
    button?.setIcon(ITEM_ICON_TEXTURE, id);
    button?.setLabel(id ? `${ITEMS[id].name.replace('회복 ', '')} ${countOf(this.inventory, id)}` : `+ 등록\n${slot === 0 ? 'Q' : 'R'}`);
    button?.setCooldown(id ? Math.max(0, this.nextUseAt - this.now) : 0, USE_COOLDOWN_MS);
  }

  private loadInventory(): Inventory {
    try {
      return parseInventory(this.storage?.getItem(INVENTORY_SAVE_KEY) ?? null);
    } catch {
      return { gold: 0, items: {} };
    }
  }

  private saveInventory(): void {
    try {
      this.storage?.setItem(INVENTORY_SAVE_KEY, serializeInventory(this.inventory));
    } catch {
      // 저장소가 막혀 있으면 이번 실행 동안만 기억한다.
    }
  }

  /** 미니맵이 다시 그릴 때만 부른다. */
  private readonly collectMinimap = () => ({
    npcs: [
      ...this.npcs.map((n) => ({ x: n.x, y: n.y, marker: n.questMarker })),
      ...this.doorMarkers.filter((d) => d.marker).map((d) => ({ x: d.spot.x, y: d.spot.y, marker: d.marker })),
      ...chapterSpots(this.quests, this.mapId).map(spot => ({ x: spot.x, y: spot.y, marker: 'target' as const })),
    ],
    enemies: this.enemies.filter((e) => e.character.alive).map((e) => ({ x: e.character.x, y: e.character.y })),
  });

  /** 몬스터의 돌진이 닿는 순간. 화살표 함수라서 콜백으로 그대로 넘길 수 있다. */
  private readonly onEnemyStrike = (enemy: Enemy, hit?: EnemyHit): boolean => {
    const player = this.player;
    const c = enemy.character;
    const now = this.now;
    if (!player.alive || this.dialogue.isOpen) return false;
    const reaches = (x: number, y: number) => hit ? enemyHitReaches(hit, x, y) : strikeReaches(c.x, c.y, c.facing, x, y);

    // 공격이 닿기 직전에 피했고, 피하지 않았다면 맞았을 자리였으면 저스트 회피다.
    if (!this.justDodged && enemy.lastStrikeAt !== undefined
      && isJustDodge(this.dodgeStartedAt, enemy.lastStrikeAt, this.justDodgeWindow)
      && reaches(this.dodgeOrigin.x, this.dodgeOrigin.y)) {
      this.onJustDodge(enemy);
      return true;
    }

    if (now < player.invulnerableUntil) return false;
    if (!reaches(player.x, player.y)) return false;

    player.invulnerableUntil = now + PLAYER.invulnerableMs;
    // 민첩(DEX): 일정 확률로 공격을 그냥 피한다.
    if (Math.random() < this.derived.evadeChance) {
      this.progressEffects.showPopup(player.x, player.y - 190, '회피', '#bfe9ff');
      this.impacts.dust(player.x, player.y, 3, now, 30);
      return true;
    }
    // 패링: 판정 시간 안에 앞쪽(바라보는 쪽)에서 온 공격은 피해 없이 막는다.
    const sourceX = hit ? player.x - hit.dx : c.x;
    if (this.blocking && (sourceX - player.x) * player.facing >= 0) {
      // 방패 앞에서 불꽃이 튀고, 공격한 적은 휘청이며, 다음 공격은 반격이 된다. 바로 다시 막을 수 있다.
      this.impacts.impact(player.x + player.facing * 60, player.y - 95, -player.facing, 0, 'counter', now, player.y);
      this.hud.showCallout('패링!');
      enemy.interrupt(now, BLOCK.stunMs);
      this.counterUntil = now + JUST_DODGE.counterMs;
      this.parryUntil = 0;
      this.parryReadyAt = now;
      this.cameras.main.shake(70, 0.002);
      this.cameras.main.flash(90, 190, 215, 255);
      this.hitStop('counter');
      return true;
    }
    // 방어력(DEF)만큼 받는 피해가 줄어든다.
    const taken = mitigate(enemy.stats.damage, this.derived);
    const died = player.hurt(taken, 0xff5a4a);
    if (this.herb) {
      // 약초 기운은 처음 맞을 때 사라진다. 남은 체력이 기본 최대보다 많으면 기본 최대로 맞춘다.
      this.herb = 0;
      player.setMaxHp(this.stats.maxHp, false);
      if (!died) this.hud.showCallout('약초 기운이 사라졌다');
    }
    player.knockback.set((hit?.dx ?? c.facing) * ENEMY.knockback, (hit?.dy ?? 0) * ENEMY.knockback * VERTICAL_SPEED_RATIO);
    this.showDamage(player.x, player.y - 190, taken, '#ff8a7a');
    if (enemy.kind === 'ashen-moth') {
      // 부식성 가루: 잠깐 몸이 무거워진다.
      if (now >= this.slowedUntil) this.hud.showCallout('잿빛 가루에 몸이 무거워졌다');
      this.slowedUntil = now + ASH_SLOW.durationMs;
      this.impacts.dust(player.x, player.y - 60, 5, now, 40);
    }
    const [shakeMs, shakeIntensity] = HIT_FEEL.shake.hurt;
    this.cameras.main.shake(shakeMs, shakeIntensity);
    this.impacts.screenFlash(0xff3b2f, 0.14, 160);
    this.impacts.dust(player.x, player.y, 4, now);
    this.hitStop('hurt');
    this.drawHud();
    if (died) this.onPlayerDeath();
    return true;
  };

  /** 막는 동안 주인공 앞(바라보는 쪽)에 반투명한 방패 빛을 그린다. */
  private drawShield(time: number): void {
    const shield = this.shield, player = this.player;
    if (!shield) return;
    shield.setVisible(this.blocking);
    if (!this.blocking) return;
    const x = player.x + player.facing * 58, y = player.y - 95;
    const pulse = 0.75 + 0.25 * Math.sin(time / 90);
    shield.clear().setDepth(player.y + 1);
    shield.fillStyle(0x9fc4ff, 0.18 * pulse).fillEllipse(x, y, 46, 150);
    shield.lineStyle(4, 0xd6e6ff, 0.75 * pulse).beginPath();
    shield.arc(x - player.facing * 40, y, 80, player.facing > 0 ? -0.9 : Math.PI - 0.9, player.facing > 0 ? 0.9 : Math.PI + 0.9);
    shield.strokePath();
  }

  /** 게임 시간을 잠깐 멈춘다. 겹치면 더 긴 쪽을 따른다. */
  private hitStop(kind: HitKind): void {
    this.hitStopLeft = Math.max(this.hitStopLeft, hitStopMs(kind));
  }

  /** 저스트 회피 성공: 느린 화면, 다음 공격 강화, 회피 재사용 대기 초기화, 피한 적은 멈칫. */
  private onJustDodge(enemy: Enemy): void {
    const now = this.now;
    this.justDodged = true;
    this.slowMotionLeft = JUST_DODGE.slowMs;
    this.counterUntil = now + JUST_DODGE.counterMs;
    this.dodgeReadyAt = now;
    this.dodgeButton.setEnabled(true);
    enemy.interrupt(now, JUST_DODGE.stunMs);
    this.hud.showCallout('저스트 회피!');
    this.impacts.dust(this.player.x, this.player.y, 6, now, 60);
    this.cameras.main.flash(120, 170, 220, 255);
  }

  private onPlayerDeath(): void {
    const player = this.player;
    this.clearAttackInput();
    this.dodgeProgress = 1;
    this.dodgeUntil = 0;
    player.setDodging(false);
    player.playDeath();

    const message = this.hud.showBanner('쓰러졌습니다', this.scale.gameSize.width, VIEW_HEIGHT);

    this.deathMessage = message;
    this.playerRespawnAt = this.now + PLAYER.respawnMs;
  }

  /** 부활은 시각 효과의 재생 시간과 무관하게 게임 시계로만 결정한다. */
  private updateRespawns(time: number): void {
    if (this.playerRespawnAt !== undefined && time >= this.playerRespawnAt) {
      this.playerRespawnAt = undefined;
      this.deathMessage?.destroy();
      this.deathMessage = undefined;
      if (!this.player.alive) {
        this.clearAttackInput();
        this.player.revive(this.map.spawn.x, this.map.spawn.y);
        this.player.invulnerableUntil = time + 1500;
        this.drawHud();
      }
    }
    for (let i = this.enemyRespawns.length - 1; i >= 0; i--) {
      const pending = this.enemyRespawns[i];
      if (time < pending.at) continue;
      this.enemyRespawns.splice(i, 1);
      if (pending.enemy.state === 'dead') this.respawnEnemy(pending.enemy);
    }
  }

  private respawnEnemy(enemy: Enemy): void {
    // 플레이어 바로 옆에서 다시 나타나지 않게 한다.
    const point = this.scratch;
    for (let i = 0; i < 20; i++) {
      this.walkArea.randomPoint(point);
      if (Math.abs(point.x - this.player.x) > ENEMY.aggroX + 80) break;
    }
    enemy.respawn(point.x, point.y);
  }

  private showDamage(x: number, y: number, amount: number, color: string, size = 34): void {
    this.damageNumbers.show(x, y, amount, Number.parseInt(color.slice(1), 16), size);
  }

  // ---------------------------------------------------------------- 디버그

  /** 주소 뒤에 ?debug 를 붙이면 이동 가능 영역과 장애물을 표시한다. */
  private drawDebug(): void {
    const g = this.add.graphics().setDepth(DEPTH_LIGHTING + 10);
    g.lineStyle(3, 0x37ff8b, 0.9);
    g.strokePoints(this.walkArea.polygon.points, true);
    g.lineStyle(3, 0xff5a5a, 0.9);
    for (const o of this.walkArea.obstacles) {
      if (o.shape === 'rect') g.strokeRect(o.x - o.rx, o.y - o.ry, o.rx * 2, o.ry * 2);
      else g.strokeEllipse(o.x, o.y, o.rx * 2, o.ry * 2);
    }
    g.lineStyle(3, 0xffd84a, 0.9);
    for (const { zone } of this.map.exits) g.strokeRect(zone.left, zone.top, zone.right - zone.left, zone.bottom - zone.top);
  }
}
