import { outdoorArtBounds } from '../world/maps';
import { EastPassScenery } from '../world/eastPassArt';
import { mapPoint } from '../world/mapScale';
import { interiorArtRect } from '../world/interiors';
import Phaser from 'phaser';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { attackBladeSweep, bladeHitsEllipse, type Blade } from '../combat/blade';
import { CombatEffects, type AttackEffect } from '../combat/CombatEffects';
import { Enemy } from '../combat/Enemy';
import { MonsterSprite, preloadMonsters } from '../combat/MonsterSprite';
import { ASH_SLOW, MONSTERS, enemyHitReaches, monsterDamageTaken, shellBlocks, type EnemyHit, type EnemyKey } from '../combat/monsterTypes';
import { isJustDodge, slowMotionScale, strikeReaches } from '../combat/justDodge';
import { critMultiplier, gameTimeScale, heavierKind, hitStopMs, strikeKind, type HitKind } from '../combat/hitFeel';
import { ImpactEffects } from '../combat/ImpactEffects';
import {
  DEPTH_LIGHTING,
  DODGE,
  JUST_DODGE,
  ENEMY,
  NPC_COMBAT,
  KNOCKBACK_DAMPING,
  PLAYER,
  PLAYER_SPEED,
  VERTICAL_SPEED_RATIO,
  VIEW_HEIGHT,
  HIT_FEEL,
  HERO_WALK_NATURAL_SPEED,
  MANA,
  SPIN_SLASH,
  RESONANCE,
  BLOCK,
} from '../config';
import { addMana, inSpinRadius, regenMana } from '../combat/mana';
import { DUSK_MOTH_LEVEL, levelHint, spawnLevel, xpForKill } from '../combat/monsterLevel';
import { allocate, deriveStats, mitigate, pointsLeft, totalStats, type DerivedStats, type StatId } from '../entities/attributes';
import { CHARACTER_SAVE_KEY, newCharacter, parseCharacter, serializeCharacter, type CharacterData } from '../entities/characterData';
import { GEAR, SLOT_INFO, addGear, buyGear, equip, gearBonus, sellGear, unequip, type GearId } from '../items/equipment';
import { CharacterPanel, type CharacterTab, type CharacterView } from '../ui/CharacterPanel';
import { preloadIcons } from '../ui/icons';
import { dodgeDistanceRatio, lungeProgress, locomotionRate } from '../entities/movement';
import { Character } from '../entities/Character';
import { addXp, statsForLevel, xpToNext, type LevelStats, type Progress } from '../entities/progression';
import { browserStorage, loadProgress, saveProgress, type SaveStorage } from '../entities/saveData';
import { ActionButton } from '../ui/ActionButton';
import { actionIcon, createActionIcons, type ActionIcon } from '../ui/actionIcons';
import { VirtualJoystick } from '../ui/VirtualJoystick';
import { HERO_SPRITE_HEIGHT, HeroSprite, preloadHeroSprite } from '../entities/HeroSprite';
import { attackFacingFor, attackVector, dodgeFacingFor, insideAttackLane, insideFrontReach, movementFacing, strikePoseStart } from '../entities/heroFrames';
import { createPlaceholderArt } from '../world/placeholderArt';
import type { WalkArea } from '../world/walkArea';
import { NavGrid } from '../world/navGrid';
import { npcExitPath } from '../world/npcExitPath';
import { buildMap, preloadVillage } from '../world/village';
import { MAPS, START_MAP, fieldPoint, findExit, isMapId, type GameMap, type MapExit, type MapId, type Point } from '../world/maps';
import { Hud, ORBS } from '../ui/Hud';
import { DamageNumbers } from '../ui/DamageNumbers';
import { DialogueBox, preloadDialogue } from '../ui/DialogueBox';
import { PauseMenu } from '../ui/PauseMenu';
import { TITLE_FADE_MS } from './TitleScene';
import { IDLE_FPS, PLAY_FPS, frameRate } from '../core/frameRate';
import { RESONANCE_SAVE_KEY, resonanceSpeed, resonanceTaken, canResonate, chargeOnParry, orbFill, parseCharge } from '../combat/resonance';
import { BUTTON_RADIUS, JOYSTICK_REST, SKILL_SLOT_COUNT, combatButtonLayout, joystickZone } from '../ui/buttonLayout';
import { SKILLS, SKILL_SAVE_KEY, learnSkill, parseSkills, serializeSkills, type SkillId, type SkillState } from '../entities/skills';
import { OpeningDirector } from './OpeningDirector';
import { OPENING, OPENING_HINT, OPENING_SAVE_KEY, OPENING_WALK_SCALE, shouldPlayOpening, type OpeningStep } from '../story/opening';
import { FESTIVAL, FESTIVAL_RAIDERS, FESTIVAL_SAVE_KEY, FESTIVAL_WALK_SCALE, RAIDER_ENTRY_MS, festivalNpcs, shouldPlayFestival } from '../story/festival';
import { FestivalStage, preloadFestival } from './FestivalStage';
import { DeathPanel } from '../ui/DeathPanel';
import { deathReport, emptyDamageLog, recordDamage, type DamageLog } from '../combat/damageLog';
import { justDodgeWindowMs, loadSettings, saveSettings, sizeScale, type Settings } from '../ui/settingsData';
import { DIALOGUES, HERO_NAME } from '../story/dialogues';
import { findInteractable, type Interactable } from '../world/interactables';
import { MARKER_STYLE, Npc, preloadNpcs } from '../entities/Npc';
import { NPCS, nextStressCount, stressNpcs } from '../world/npcs';
import { chapterTwoPreviewNpcs, isCastPreviewGroup, previewCastNpcs, type CastPreviewGroup } from '../world/chapterTwoNpcs';
import { CHAPTER_TWO_INSPECTIONS, FERN, FERN_CART, FERN_CART_FOOTPRINT, chapterTwoDialogue, chapterTwoNpcs, chapterTwoSpots, fernCartState, fernCartVisible, fernMothHunt, fernShopOpen, shelterRestOpen } from '../story/chapterTwo';
import fernCartDamagedUrl from '../assets/village/rowen/fern-cart-damaged.webp?url';
import fernCartRepairedUrl from '../assets/village/rowen/fern-cart-repaired.webp?url';
import { PerfOverlay } from '../ui/PerfOverlay';
import { Minimap } from '../ui/Minimap';
import { QuestTracker } from '../ui/QuestTracker';
import { StoryChoice } from '../ui/StoryChoice';
import { CLINIC_BED_SPOT, HOME_BED_SPOT, REST_POINTS, herbBonus, REST_SAVE_KEY, canRest, parseRestPoint, serializeRestPoint, type RestPointId } from '../story/restPoints';
import { DUSK_MOTH_POINTS, chapterPhase, chapterNpcs, chapterSpots, chapterDialogue, chapterCanTalk, lineaRecovery, isDusk, raidSpawns, raidSpawnsAnyStep, INSPECTION_LINES, type RaidSpawn } from '../story/chapterOne';
import { BOSS, entersPhaseTwo } from '../combat/bossPattern';
import { COMPANION, COMPANION_SAVE_KEY, canEngage, companionDamage, companionNpcDef, followPlan, followSpot, isCompanionId, parseCompanion, type CompanionId } from '../entities/companion';
import { ARENA, bossLanding, chooseArena, entryPoint, insideArena, pushTowardArena, type Arena } from '../combat/bossArena';
import { BossHud } from '../ui/BossHud';
import { GuideCard } from '../ui/GuideCard';
import { GUIDE_SAVE_KEY, activeLesson, lessonToShow, parseSeenLessons, serializeSeenLessons, type GuideButton, type LessonId } from '../story/tutorial';
import { maxCharge } from '../combat/resonance';
import {
  currentObjective, MARKER_PRIORITY, QUEST_SAVE_KEY, markerFor, parseQuests, recordEvent, serializeQuests, talkTo, type QuestEvent, type QuestMarker, type QuestState,
  type InspectSpot,
} from '../story/quests';
import { GUARDS, guardsForMap } from '../world/guards';
import { defenderRecovery, loadDefenderInjuries, saveDefenderInjuries } from '../story/defenderRecovery';
import type { NpcId } from '../world/npcs';
import { QuickSlotPanel } from '../ui/QuickSlotPanel';
import { loadQuickSlots, saveQuickSlots, type QuickSlots } from '../items/quickSlots';
import { ITEM_ICON_TEXTURE, preloadItemIcons, registerItemIcons } from '../ui/itemIcons';
import { ItemPanel, type PanelAction } from '../ui/ItemPanel';
import { WorldMap } from '../ui/WorldMap';
import { ExitHint } from '../ui/ExitHint';
import { VISITED_SAVE_KEY, parseVisited, regionOf, serializeVisited, type RegionId } from '../world/worldMap';
import {
  INVENTORY_SAVE_KEY, ITEMS, USE_COOLDOWN_MS, addGold, addItem, applyDrop, buy, canUse, countOf, parseInventory,
  sell, serializeInventory, slimeDrop, useConsumable, type Inventory, type ItemId, type ShopId, type UseStatus,
} from '../items/inventory';
import { ProgressEffects } from '../ui/ProgressEffects';

/** 고개의 쉼터에서 하룻밤을 보낼 때 화면이 어두워지고 밝아지는 시간 (ms, 연출만) */
const NIGHT_FADE_MS = 900;
/** 위쪽 3타 찌르기 빛줄기를 원근으로 짧게 그린 칼끝 너머 먼 곳까지 늘이는 배율 */
const UP_THRUST_REACH = 1.9;

/** Scale shared by all academy frames. */
/** 기술 칸에 넣을 수 있는 기술 (배우는 방법은 아직 없다) */

const HERO_SCALE = 0.5;
const NAV_CELL = 32;
/** 카메라가 시온을 따라갈 때 시온을 화면 가운데보다 이만큼 아래에 둔다 */
const CAMERA_FOLLOW_OFFSET_Y = 170;
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
  /** 맵을 옮길 때 이어지는 공명 남은 시간(ms). 한 번 쓰고 지운다. */
  resonance?: number;
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
  /** 이 맵에 들어오거나 다시 일어난 뒤 받은 피해 (쓰러지면 보여 준다) */
  private damageLog: DamageLog = emptyDamageLog();
  /** 쓰러졌을 때의 창: 누구에게 얼마나 맞았는지, 확인하면 마지막으로 쉰 곳으로 */
  private deathPanel?: DeathPanel;
  /** 1장 보스: 경고·체력 막대, 싸우는 보스, 경고가 끝나는 시각과 그때 나올 무리, 포효가 끝나는 시각 (게임 시계) */
  private bossHud?: BossHud;
  private boss?: Enemy;
  private bossWarningEnd?: number;
  private pendingBoss?: RaidSpawn[];
  private bossRoarUntil = 0;
  /**
   * 보스전 결계(combat/bossArena.ts): 고리, 닫혔는지, 걷히는 시각, 원래 걸을 수 있는 영역, 물러난 병사들.
   * 경고가 뜨면 고리가 번지고 병사들이 물러나며, 보스가 나타나면 닫혀 walkArea가 고리 안으로 좁아진다.
   */
  private arena?: Arena;
  private arenaClosed = false;
  private arenaFadeAt?: number;
  private arenaOpenedAt = 0;
  private baseWalkArea?: WalkArea;
  private awayNpcs = new Set<Npc>();
  private departingNpcs = new Set<Npc>();
  private arenaRing?: Phaser.GameObjects.Graphics;
  /**
   * 동료(entities/companion.ts): 함께 다니는 사람(저장된다), 그려지는 NPC, 쓰러진 시각, 패링·저스트 회피로 먼저 노릴 적.
   * 동료는 this.npcs에 넣지 않는다(대화·퀘스트 표시·결계·습격 배치에서 빠진다).
   */
  private companionId?: CompanionId;
  private companion?: Npc;
  private companionDownAt?: number;
  private companionFocus?: { enemy: Enemy; until: number };
  /** 초반 전투 가이드(story/tutorial.ts): 안내 창과 이미 본 안내 */
  private guideCard?: GuideCard;
  private seenLessons = new Set<LessonId>();
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
  private primaryAction: ActionIcon = 'attack';
  private suppressAttackUntilRelease = false;
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
  /** 새 게임 첫 시작에 보여 주는 오프닝 연출. 끝나면 undefined */
  private opening?: OpeningDirector;
  /** 오프닝 동안 조이스틱 대신 쓰는 시온의 이동 방향 */
  private readonly openingInput = new Phaser.Math.Vector2();
  /** 오프닝 동안 숨겨 둔 화면 고정 UI (끝나면 다시 보인다) */
  private openingHidden: Array<Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown }> = [];
  private playOpening = false;
  /** 1장 수확제 연출(story/festival.ts)을 이번에 광장에서 보여 주는지. 연출 동안 마을 사람 배치와 권속이 다르다. */
  private playFestival = false;
  /** 지금 연출의 걷는 빠르기 (오프닝·축제가 다르다) */
  private cutsceneWalkScale = OPENING_WALK_SCALE;
  private passScenery?: EastPassScenery;
  private festivalStage?: FestivalStage;
  /** 축제 연출 끝에 남문으로 걸어 들어오는 권속 (싸우지 않는 그림뿐. 연출이 끝나면 광장을 다시 열어 진짜 무리가 나온다) */
  private festivalRaiders: Array<{ enemy: Enemy; path: readonly Point[]; startedAt: number }> = [];
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
  /** 공명 게이지(구슬 조각 수, combat/resonance.ts)와 공명이 끝나는 시각(게임 시계) */
  private resonanceCharge = 0;
  private resonanceUntil = 0;
  private carriedResonance?: number;
  private resonanceButton?: ActionButton;
  private resonanceKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 공명 중 발밑의 금빛 고리 (한 번 그려 두고 옮기기만 한다) */
  private resonanceAura?: Phaser.GameObjects.Graphics;
  /** 공격 버튼 둘레의 기술 칸 다섯. 기술은 배우면 칸에 넣는다(지금은 모두 비어 있다). 키 1~5. */
  private skillButtons: ActionButton[] = [];
  private skillSlots: (SkillId | null)[] = [];
  /** 배운 기술 (저장). skillSlots는 그 칸 배치를 그대로 쓴다. */
  private learnedSkills: SkillId[] = [];
  /** 지금 연 상점 (물품 창의 구매가 이 상점의 물건만 산다) */
  private shopId: ShopId = 'merina';
  private skillKeys: Phaser.Input.Keyboard.Key[] = [];
  /** 다른 맵으로 옮겨 가는 중(화면이 어두워지는 동안). 그동안 게임은 멈춘다. */
  private traveling = false;
  private nav!: NavGrid;
  /** 이 맵의 마을 사람들 */
  private npcs: Npc[] = [];
  /** 마을 사람이 목적지로 고를 수 있는 곳: 맵 출구 안은 뺀다. */
  private readonly npcCanStand = (x: number, y: number): boolean => !findExit(this.map, x, y);
  /** 말을 걸 수 있는 대상: 맵의 표지판·문과 마을 사람들 */
  private interactables: Interactable[] = [];
  /** 성능 테스트로 마을에 더 세우는 사람 수 (0 = 끔). 재시작해도 유지한다. ?stress=100으로도 켤 수 있다. */
  private stressCount = Math.max(0, Math.min(500, Number(new URLSearchParams(location.search).get('stress')) || 0));
  private perf?: PerfOverlay;
  /** 퀘스트 진행. 바뀔 때마다 기기에 저장한다(진행 상황과 따로). */
  private quests: QuestState = {};
  private defenderInjuries = new Set<NpcId>();
  private storyChoice?: StoryChoice;
  /** 마지막으로 대화를 넘긴 누름 (onDialoguePointer) */
  private dialogueTap?: { id: number; downTime: number };
  private storyMarkers: Phaser.GameObjects.Text[] = [];
  private raidEnemies = new Set<Enemy>();
  /** 습격의 밤 그늘. Rectangle의 반투명 채우기는 Phaser 4에서 훨씬 옅게 그려져 Graphics로 그린다. */
  private chapterShade?: Phaser.GameObjects.Graphics;
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
    if (this.previewNpcGroup) {
      // 본편의 1장 배치나 진행 조건을 바꾸지 않고 같은 NPC·대화 시스템으로 새 원화를 확인한다.
      const at = mapPoint({ x: 1400, y: 1250 });
      this.map = { ...this.map, name: '2장 인물 확인', hint: '2장 인물 확인 · 가까이 가서 대화해 보세요',
        spawn: { x: at.x, y: at.y + 170 }, npcs: previewCastNpcs(this.previewNpcGroup, at), enemies: [], exits: [],
        props: [], buildings: [], interactables: [], obstacles: [] };
    }
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
    this.carriedResonance = data.resonance;
    data.resonance = undefined;
    // 저장된 진행 상황이 있으면 그 레벨로 시작한다 (재시작 포함).
    this.storage = browserStorage();
    this.quests = this.loadQuests();
    this.defenderInjuries = loadDefenderInjuries(this.storage, this.quests);
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
    // 새 게임을 처음 시작하면 오프닝을 보여 준다. 개발 빌드에서는 ?opening으로 언제든 볼 수 있다.
    const forced = import.meta.env.DEV && new URLSearchParams(location.search).has('opening');
    let seen = false;
    try { seen = this.storage?.getItem(OPENING_SAVE_KEY) === 'seen'; } catch { seen = false; }
    this.playOpening = this.mapId === 'village-north' && (forced || shouldPlayOpening({
      fromTitle: this.fromTitle, hasProgress: !!saved, quests: this.quests, seen,
    }));
    // 로제타에게 잔치 준비가 됐다고 하면 광장에서 수확제 연출을 본다(아직 보지 않았으면 앱을 다시 켜도).
    // 개발 빌드에서는 습격이 막 시작된 저장으로 ?festival을 붙이면 다시 볼 수 있다.
    let festival: string | null = null;
    try { festival = this.storage?.getItem(FESTIVAL_SAVE_KEY) ?? null; } catch { festival = null; }
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('festival')) festival = 'pending';
    this.playFestival = !this.playOpening && shouldPlayFestival({ map: this.mapId, quests: this.quests, saved: festival });
  }

  /**
   * 해 질 무렵(chapterOne.isDusk)에는 남쪽 들판에 잿빛 나방이 더 나온다. 2장 "남문의 수레"의 나방 쫓기 동안에도
   * 습격 뒤 남은 나방 넷이 같은 자리에 있다(story/chapterTwo.ts).
   */
  private duskSpawns(): Array<{ key: 'ashen-moth'; x: number; y: number }> {
    if (this.mapId !== 'south-field' || (!isDusk(this.quests) && !fernMothHunt(this.quests))) return [];
    return DUSK_MOTH_POINTS.map(([x, y]) => ({ key: 'ashen-moth', ...fieldPoint(x, y) }));
  }

  private resetState(): void {
    this.slowedUntil = 0;
    this.enemies = [];
    this.npcs = [];
    this.interactables = [];

    this.perf = undefined;
    this.quests = {};
    this.defenderInjuries = new Set();
    this.storyChoice = undefined;
    this.dialogueTap = undefined;
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
    this.damageLog = emptyDamageLog();
    this.deathPanel = undefined;
    this.bossHud = undefined;
    this.boss = undefined;
    this.bossWarningEnd = undefined;
    this.pendingBoss = undefined;
    this.bossRoarUntil = 0;
    this.arena = undefined;
    this.arenaClosed = false;
    this.arenaFadeAt = undefined;
    this.arenaOpenedAt = 0;
    this.baseWalkArea = undefined;
    this.awayNpcs = new Set();
    this.departingNpcs = new Set();
    this.companion = undefined;
    this.companionDownAt = undefined;
    this.companionFocus = undefined;
    this.arenaRing = undefined;
    this.occluderCache = undefined;
    this.guideCard = undefined;
    this.seenLessons = new Set();
    this.traveling = false;
    this.arrival = undefined;
    this.carriedHp = undefined;
    this.carriedHerb = undefined;
    this.herb = 0;
    this.opening = undefined;
    this.openingInput.set(0, 0);
    this.openingHidden = [];
    this.playOpening = false;
    this.playFestival = false;
    this.cutsceneWalkScale = OPENING_WALK_SCALE;
    this.festivalStage = undefined;
    this.passScenery = undefined;
    this.festivalRaiders = [];
    this.mp = 0;
    this.maxMp = 0;
    this.shownMp = -1;
    this.carriedMp = undefined;
    this.carriedResonance = undefined;
    this.spinHitAt = undefined;
    this.nextSpinAt = 0;
    this.resonanceCharge = 0;
    this.resonanceUntil = 0;
    this.resonanceButton = undefined;
    this.resonanceKeys = [];
    this.resonanceAura = undefined;
    this.skillButtons = [];
    this.skillSlots = Array<SkillId | null>(SKILL_SLOT_COUNT).fill(null);
    this.learnedSkills = [];
    this.skillKeys = [];
  }

  preload(): void {
    preloadHeroSprite(this);
    if (this.playFestival) preloadFestival(this);
    preloadIcons(this);
    // 습격 중에는 이 맵에 나올 모든 무리의 그림을 미리 읽는다(대화 뒤 다음 무리가 바로 나타난다).
    preloadMonsters(this, [...this.map.enemies, ...this.duskSpawns(), ...raidSpawnsAnyStep(this.quests, this.mapId), ...this.previewMonsters()]);
    preloadVillage(this, this.map);
    preloadNpcs(this, [...NPCS, FERN, ...this.map.npcs, ...GUARDS, ...chapterTwoPreviewNpcs({ x: 0, y: 0 })]);
    if (fernCartVisible(this.quests, this.mapId)) {
      this.load.image('fern-cart-damaged', fernCartDamagedUrl);
      this.load.image('fern-cart-repaired', fernCartRepairedUrl);
    }
    preloadDialogue(this);
    preloadItemIcons(this);
  }

  create(): void {
    createPlaceholderArt(this);
    this.walkArea = buildMap(this, this.map);
    if (this.mapId === 'east-pass') this.passScenery = new EastPassScenery(this);
    this.placeFernCart();
    const bounds = this.walkArea.bounds;
    this.nav = new NavGrid(bounds.left, bounds.top, bounds.right, bounds.bottom, NAV_CELL,
      (x, y) => this.walkArea.contains(x, y));
    this.bossHud = new BossHud(this);
    this.buildCharacters();
    this.effects = new CombatEffects(this);
    this.impacts = new ImpactEffects(this);
    this.buildUi();
    this.damageNumbers = new DamageNumbers(this);
    this.progressEffects = new ProgressEffects(this);
    this.dialogue = new DialogueBox(this);
    this.storyChoice = new StoryChoice(this, () => this.onResume());
    this.deathPanel = new DeathPanel(this);
    this.guideCard = new GuideCard(this);
    try { this.seenLessons = parseSeenLessons(this.storage?.getItem(GUIDE_SAVE_KEY) ?? null); } catch { this.seenLessons = new Set(); }
    this.loadCompanion();
    this.loadSkills();
    this.spawnCompanion();
    if (chapterPhase(this.quests) === 'raid') {
      this.chapterShade = this.add.graphics().setScrollFactor(0).setDepth(DEPTH_LIGHTING);
      this.drawChapterShade(this.scale.gameSize.width);
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
    this.potionButton = new ActionButton(this, { x: 0, y: 0, radius: BUTTON_RADIUS.item, label: '', color: 0x3e2221, fontSize: 18, icon: { texture: ITEM_ICON_TEXTURE, frame: 'potion' }, cooldown: true, releaseToPress: true, onLongPress: () => this.openQuickSlot(0), ignore: this.ignoreCombatPress });
    this.lunchButton = new ActionButton(this, { x: 0, y: 0, radius: BUTTON_RADIUS.item, label: '', color: 0x38442a, fontSize: 18, icon: { texture: ITEM_ICON_TEXTURE, frame: 'lunch' }, cooldown: true, releaseToPress: true, onLongPress: () => this.openQuickSlot(1), ignore: this.ignoreCombatPress });
    this.lunchKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R)] : [];
    this.potionButton.setSizeScale(sizeScale(this.settings.buttonSize));
    this.lunchButton.setSizeScale(sizeScale(this.settings.buttonSize));
    this.potionKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)] : [];
    this.skillButtons = this.skillSlots.map(() => new ActionButton(this, { x: 0, y: 0, radius: BUTTON_RADIUS.skill, label: '', color: 0x2a3140, fontSize: 13, cooldown: true, ignore: this.ignoreCombatPress }));
    for (const button of this.skillButtons) button.setSizeScale(sizeScale(this.settings.buttonSize));
    const digits = [Phaser.Input.Keyboard.KeyCodes.ONE, Phaser.Input.Keyboard.KeyCodes.TWO, Phaser.Input.Keyboard.KeyCodes.THREE,
      Phaser.Input.Keyboard.KeyCodes.FOUR, Phaser.Input.Keyboard.KeyCodes.FIVE];
    this.skillKeys = this.input.keyboard ? digits.slice(0, SKILL_SLOT_COUNT).map(code => this.input.keyboard!.addKey(code)) : [];
    this.refreshSkillButtons();
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
    // 공명 버튼: 물약 칸 위(자리는 layout). 키 F.
    this.resonanceButton = new ActionButton(this, {
      x: 0, y: 0, radius: BUTTON_RADIUS.resonance, label: '공명', icon: actionIcon('resonance'), color: 0x6a4a12, fontSize: 22, cooldown: true, ignore: this.ignoreCombatPress,
    });
    this.resonanceButton.setSizeScale(sizeScale(this.settings.buttonSize));
    this.resonanceKeys = this.input.keyboard ? [this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F)] : [];
    this.resonanceAura = this.add.graphics().setVisible(false);
    this.resonanceAura.lineStyle(5, 0xffd76a, 0.9).strokeEllipse(0, 0, 150, 150 * VERTICAL_SPEED_RATIO);
    this.resonanceAura.lineStyle(12, 0xffd76a, 0.25).strokeEllipse(0, 0, 166, 166 * VERTICAL_SPEED_RATIO);
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
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, CAMERA_FOLLOW_OFFSET_Y);
    if (this.fromTitle) this.cameras.main.fadeIn(TITLE_FADE_MS, 0, 0, 0);
    else if (this.arrival) this.cameras.main.fadeIn(TRAVEL_FADE_MS, 0, 0, 0);
    if (this.playOpening) this.startOpening();
    else if (this.playFestival) this.startFestival();

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
        || !!this.worldMap?.isOpen || !!this.itemPanel?.isOpen || !!this.characterPanel?.isOpen || !!this.storyChoice?.isOpen || !!this.quickSlotPanel?.isOpen || !!this.opening,
        chapterPhase(this.quests) === 'raid' && this.mapId === 'village');
    }
    this.setQuickButtonsVisible(!this.traveling && !!this.player?.alive && !this.dialogue.isOpen && !this.pauseMenu.isOpen
      && !this.characterPanel?.isOpen && !this.itemPanel?.isOpen && !this.worldMap?.isOpen && !this.storyChoice?.isOpen && !this.quickSlotPanel?.isOpen
      && !this.deathPanel?.isOpen);
    this.updateGuideHighlight();
    // 게임 안의 모든 시간 계산은 이 시계 하나만 쓴다.
    // 프레임이 끊겨도 이동 거리와 타이밍이 서로 어긋나지 않게 하기 위해서다.
    const step = Math.min(delta, 50);
    // 맵을 옮기는 동안에는 아무것도 진행하지 않는다.
    if (this.traveling) return;
    // 메뉴·대화·창이 열려 게임이 멈춰 있는 동안에는 덜 자주 그린다(발열·전력).
    frameRate.fps = this.menuOpen() ? IDLE_FPS : PLAY_FPS;

    // 일시정지 중에는 게임 시계를 멈춘다. Esc는 메뉴에서 한 단계 뒤로.
    let escape = false;
    for (const key of this.pauseKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) escape = true;
    }
    // 오프닝 중 Esc는 건너뛰기다.
    if (this.opening && escape) {
      this.opening.skip();
      escape = false;
    }
    // 전투 가이드 창: 확인(Enter·Space·E·J·Esc)으로 닫는다. 그동안 게임은 멈춰 있다.
    if (this.guideCard?.isOpen) {
      let confirm = escape || this.talkPressed();
      for (const key of this.attackKeys) if (Phaser.Input.Keyboard.JustDown(key)) confirm = true;
      if (confirm) this.guideCard.close();
      return;
    }
    // 쓰러진 뒤의 창: 확인(Enter·Space·E·J·Esc)을 누를 때까지 게임은 멈춰 있다.
    if (this.deathPanel?.isOpen) {
      let confirm = escape || this.talkPressed();
      for (const key of this.attackKeys) if (Phaser.Input.Keyboard.JustDown(key)) confirm = true;
      if (confirm) this.deathPanel.confirm();
      return;
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

    // 수련 연습이 막 시작됐으면 시스템 안내 창을 한 번 띄운다.
    if (this.showLessonIfNew()) return;

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
    this.opening?.update(time);
    this.festivalStage?.update(time);
    this.passScenery?.update(time, this.player);
    this.updateFestivalRaiders(time);
    this.updateRespawns(time);
    this.updateBoss(time, dt);
    this.updateAttackLunge(time);
    this.updateInteraction(time);
    if (this.traveling || this.menuOpen()) return;
    // 보스가 포효하는 동안에는 주인공도 멈춰 선다.
    if (time < this.bossRoarUntil) {
      this.player.setMotion(false);
      this.clearAttackInput();
    } else {
      this.updatePlayer(time, dt);
      this.drawShield(time);
      if (this.checkExit()) return;
      this.updateAttackTrace(time);
    }
    this.updateNpcCombat(time, dt);
    this.updateCompanion(time, dt);
    this.nav.setTarget(this.player.x, this.player.y);
    for (const enemy of this.enemies) {
      const defender = this.defenderTarget(enemy);
      enemy.update(time, dt, this.player, this.walkArea, this.nav, this.onEnemyStrike, this.onBossHazard,
        defender ? { x: defender.x, y: defender.y, alive: defender.canFight } : undefined);
      this.applyKnockback(enemy.character, dt);
    }
    this.separateEnemies(dt);
    for (const npc of this.npcs) if (!this.awayNpcs.has(npc)) npc.update(time, dt, this.player, this.walkArea, this.npcCanStand);
    this.finishSerenaEvacuation();
    for (const door of this.doorMarkers) if (door.marker) door.text.setY(door.spot.y - 150 - Math.abs(Math.sin(time / 320)) * 8);
    this.applyKnockback(this.player, dt);
    this.damageNumbers.update(gameStep);
    this.updatePotion(time);
    this.updateSkill(time, gameStep);
    this.updateResonance(time);
    this.updateCombatCooldowns(time);
  }

  /** 습격 때만 전투에 참여한다. 평소 NPC 순찰과 축제 연출은 기존 제어를 유지한다. */
  private updateNpcCombat(time: number, dt: number): void {
    const targets = this.enemies.map((enemy, id) => ({ id, x: enemy.character.x, y: enemy.character.y,
      alive: enemy.character.alive && !enemy.untouchable, attacking: enemy.state === 'windup' }));
    for (const npc of this.npcs) {
      if (this.awayNpcs.has(npc)) continue;
      this.syncDefenderRecovery(npc);
      npc.updateCombat(time, dt, targets, this.walkArea, this.npcCanStand, (id, damage) => this.allyStrike(npc, id, damage, time));
    }
  }

  private syncDefenderRecovery(npc: Npc): void {
    if (!npc.isFighter) return;
    const phase = chapterPhase(this.quests);
    if (phase === 'raid' && npc.downed && !this.defenderInjuries.has(npc.def.id)) {
      this.defenderInjuries.add(npc.def.id);
      saveDefenderInjuries(this.storage, this.defenderInjuries);
    }
    const recovery = this.playFestival ? undefined : defenderRecovery(npc.def.id, this.quests, this.defenderInjuries);
    const action = recovery === 'rest' || recovery === 'sentry' ? recovery : undefined;
    if (action !== undefined && (!npc.isRecovering || npc.currentStoryAction !== action)) npc.setRecovery(action);
    else if (action === undefined && npc.isRecovering) npc.setRecovery();
    npc.setBattle(phase === 'raid' && !this.playFestival && !action, recovery === 'injured');
  }

  /** 아군(수비대·동료)의 일격이 적에게 닿았다. 처치·다음 무리·경험치는 주인공의 일격과 같은 경로로 처리한다. */
  private allyStrike(npc: Npc, id: number, damage: number, time: number): void {
    const enemy = this.enemies[id];
    if (!enemy?.character.alive || enemy.untouchable) return;
    const c = enemy.character, distance = Math.hypot(c.x-npc.x, c.y-npc.y) || 1;
    const dx = (c.x-npc.x)/distance, dy = (c.y-npc.y)/distance;
    const taken = monsterDamageTaken(damage, enemy.stats.defense);
    const died = c.hurt(taken);
    this.showDamage(c.x, c.y-95, taken, '#bfe9ff', 26);
    this.impacts.impact(c.x, c.y-65, dx, dy, 'normal', time, c.y);
    this.resolveEnemyHit(enemy, died, dx, dy, NPC_COMBAT.knockback);
  }

  private defenderTarget(enemy: Enemy): Npc | undefined {
    if (enemy.boss) return;
    const c = enemy.character;
    const playerDistance = Math.hypot(this.player.x-c.x, this.player.y-c.y);
    // 습격의 적은 가까운 수비대를, 어느 적이든 가까운 동료를 노릴 수 있다.
    const candidates = [...(this.raidEnemies.has(enemy) ? this.npcs : []), ...this.companionFighters()];
    return candidates.filter(npc => npc.canFight
      && Math.hypot(npc.x-c.x, npc.y-c.y) < Math.min(NPC_COMBAT.engageRadius, playerDistance)
      && this.walkArea.hasClearPath(c.x, c.y, npc.x, npc.y))
      .sort((a, b) => Math.hypot(a.x-c.x, a.y-c.y)-Math.hypot(b.x-c.x, b.y-c.y))[0];
  }

  // ---------------------------------------------------------------- 오프닝

  /** 새 게임 첫 시작: 화면 고정 UI를 숨기고 오프닝 연출을 시작한다. */
  private startOpening(): void {
    this.startCutscene(OPENING, OPENING_WALK_SCALE, (skipped) => this.finishOpening(skipped));
  }

  /** 화면 고정 UI를 숨기고 연출 대본을 실행한다(오프닝·수확제 공통). 습격의 밤 그늘은 그대로 둔다. */
  private startCutscene(steps: OpeningStep[], walkScale: number, finish: (skipped: boolean) => void, cue?: (name: string) => void): void {
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.cutsceneWalkScale = walkScale;
    // 화면에 고정된 UI(체력 막대·버튼·미니맵 등)를 잠시 숨긴다. 대화창은 열릴 때 스스로 나타난다.
    this.openingHidden = this.children.list.filter((o): o is Phaser.GameObjects.GameObject & { setVisible(v: boolean): unknown; visible: boolean; scrollFactorX: number } =>
      o !== this.chapterShade && 'scrollFactorX' in o && (o as { scrollFactorX: number }).scrollFactorX === 0 && 'visible' in o && (o as { visible: boolean }).visible);
    for (const o of this.openingHidden) o.setVisible(false);
    this.opening = new OpeningDirector({
      scene: this,
      hero: () => ({ x: this.player.x, y: this.player.y }),
      setHeroInput: (x, y) => this.openingInput.set(x, y),
      placeHero: (x, y) => this.player.placeAt(x, y),
      npc: (id) => this.npcs.find((n) => n.def.id === id),
      say: (lines, done) => {
        this.clearAttackInput();
        this.dialogue.open(lines, () => { done(); this.clearAttackInput(); });
      },
      closeDialogue: () => { if (this.dialogue.isOpen) this.dialogue.close(); },
      heroCamera: () => ({ x: this.player.x, y: this.player.y - CAMERA_FOLLOW_OFFSET_Y }),
      followHero: () => this.cameras.main.startFollow(this.player, true, 0.12, 0.12, 0, CAMERA_FOLLOW_OFFSET_Y),
      cue,
      finish,
    }, steps);
  }

  /** 1장 수확제 연출: 마을 사람을 잔치 자리에 세우고, 모닥불·등불을 그리고 대본을 시작한다. */
  private startFestival(): void {
    for (const npc of this.npcs) if (!npc.def.id.startsWith('guard-')) npc.placeAt(npc.x, npc.y);
    this.startCutscene(FESTIVAL, FESTIVAL_WALK_SCALE, (skipped) => this.finishFestival(skipped), (name) => {
      if (name === 'raiders') this.spawnFestivalRaiders();
      else this.festivalStage?.cue(name);
    });
    this.festivalStage = new FestivalStage(this);
  }

  /** 연출 속 권속: 남문 밖에서 걸어 들어와 선다. 싸우지 않는다(장면의 적 목록에 넣지 않는다). */
  private spawnFestivalRaiders(): void {
    for (const raider of FESTIVAL_RAIDERS) {
      const start = raider.path[0];
      const enemy = new Enemy(this, raider.key, start.x, start.y, raider.level);
      this.festivalRaiders.push({ enemy, path: raider.path, startedAt: this.now });
    }
  }

  /** 길을 따라 RAIDER_ENTRY_MS 동안 같은 빠르기로 걷는다(게임 시계). */
  private updateFestivalRaiders(time: number): void {
    for (const raider of this.festivalRaiders) {
      const t = Math.min(1, (time - raider.startedAt) / RAIDER_ENTRY_MS);
      const p = raider.path;
      const lengths = p.slice(1).map((q, i) => Math.hypot(q.x - p[i].x, q.y - p[i].y));
      let left = t * lengths.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < lengths.length - 1 && left > lengths[i]) left -= lengths[i++];
      const f = lengths[i] > 0 ? Math.min(1, left / lengths[i]) : 1;
      const c = raider.enemy.character;
      c.placeAt(p[i].x + (p[i + 1].x - p[i].x) * f, p[i].y + (p[i + 1].y - p[i].y) * f);
      c.setMotion(t < 1, t < 1 ? p[i + 1].x - p[i].x : 0);
    }
  }

  /** 수확제 연출이 끝나거나 건너뛰면 다시 보지 않게 적고, 광장을 습격 상태로 다시 연다(첫 무리와 싸운다). */
  private finishFestival(_skipped: boolean): void {
    try {
      this.storage?.setItem(FESTIVAL_SAVE_KEY, 'seen');
    } catch {
      // 저장소가 막혀 있으면 다음에 광장에 들어올 때 다시 볼 수 있다.
    }
    this.openingInput.set(0, 0);
    this.clearAttackInput();
    // 연출은 끝났지만 화면 UI는 숨긴 채 어두워졌다가, 다시 열린 광장에서 돌아온다.
    this.opening = undefined;
    const at = { x: this.player.x, y: this.player.y };
    this.travel({ to: 'village', arrive: at, zone: { left: 0, top: 0, right: 0, bottom: 0 }, label: '', labelAt: at });
  }

  /** 오프닝이 끝나거나 건너뛰었을 때: UI를 되돌리고, 마을 사람을 풀어 주고, 다시 보지 않게 저장한다. */
  private finishOpening(skipped: boolean): void {
    this.opening = undefined;
    this.openingInput.set(0, 0);
    for (const o of this.openingHidden) if (o.active) o.setVisible(true);
    this.openingHidden = [];
    for (const npc of this.npcs) npc.release();
    try {
      this.storage?.setItem(OPENING_SAVE_KEY, 'seen');
    } catch {
      // 저장소가 막혀 있으면 다음에 다시 볼 수 있다.
    }
    this.clearAttackInput();
    this.cameras.main.fadeIn(skipped ? 400 : 900, 0, 0, 0);
    this.hud.setHint(OPENING_HINT);
  }

  // ---------------------------------------------------------------- 월드

  /** ?map=east-stream&npcs=chapter2: 미구현 2장 인물의 그림·대화 확인용. 배포판에는 적용하지 않는다. */
  /**
   * 개발용: ?monsters=종류 로 2장 몬스터의 원화와 동작을 확인한다.
   * 배포판에는 적용하지 않는다.
   */
  private previewMonsters(): Array<{ key: EnemyKey; x: number; y: number }> {
    if (!import.meta.env.DEV) return [];
    const key = new URLSearchParams(location.search).get('monsters');
    const s = this.map.spawn;
    if (this.mapId === 'reed-swamp' && (key === 'mist-phantom' || key === 'mist-weaver')) {
      return [{ key, x: s.x + 245, y: s.y }];
    }
    if (key !== 'frost-beetle' && key !== 'fog-crow') return [];
    return [-260, 0, 260].map((dx) => ({ key, x: s.x + dx, y: s.y - 260 }));
  }

  private get previewNpcGroup(): CastPreviewGroup | undefined {
    if (!import.meta.env.DEV || this.mapId !== 'east-stream') return undefined;
    const group = new URLSearchParams(location.search).get('npcs');
    return isCastPreviewGroup(group) ? group : undefined;
  }

  private buildCharacters(): void {
    // 사냥터 몬스터는 그 맵의 권장 레벨 범위를 차례로 받는다. 해 질 무렵의 나방은 따로 정한 레벨.
    this.map.enemies.forEach((spawn, i) => this.enemies.push(new Enemy(this, spawn.key, spawn.x, spawn.y, spawnLevel(this.mapId, i))));
    for (const spawn of this.duskSpawns()) this.enemies.push(new Enemy(this, spawn.key, spawn.x, spawn.y, DUSK_MOTH_LEVEL));
    for (const spawn of this.previewMonsters()) this.enemies.push(new Enemy(this, spawn.key, spawn.x, spawn.y, 9));
    this.syncRaidEnemies(false);
    // 축제 연출 동안에는 마을 사람 모두가 광장의 잔치 자리에 있다.
    let defs = this.previewNpcGroup ? this.map.npcs
      : this.playFestival ? festivalNpcs() : [...chapterNpcs([...this.map.npcs, ...guardsForMap(this.mapId)], this.quests, this.mapId), ...chapterTwoNpcs(this.quests, this.mapId)];
    if (this.stressCount > 0 && this.mapId === 'village' && chapterPhase(this.quests) === 'day') {
      const area = this.walkArea, b = this.map.bounds;
      defs = [...defs, ...stressNpcs(this.stressCount, defs, Math.random, b, (x, y) => area.contains(x, y) && !findExit(this.map, x, y))];
    }
    this.npcs = defs.map((def) => {
      const npc = new Npc(this, def);
      this.syncDefenderRecovery(npc);
      return npc;
    });
    if (this.previewNpcGroup === 'innkeeper' && new URLSearchParams(location.search).get('sleepwalk') === '1') {
      const innkeeper = this.npcs[0];
      innkeeper.startSleepwalk([{ x: innkeeper.x + 260, y: innkeeper.y + 65 }]);
    }
    if (this.previewNpcGroup === 'support' || this.previewNpcGroup === 'all') {
      const action = new URLSearchParams(location.search).get('action');
      for (const npc of this.npcs) {
        if (npc.def.id === 'toby') npc.setStoryAction(action === 'cocoon' ? 'cocoon' : action === 'idle' ? undefined : 'bellows');
        if (npc.def.id === 'bell-ringer' && action !== 'idle') npc.setStoryAction('ring');
      }
    }
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
    if (this.player.sprite instanceof HeroSprite) this.player.sprite.setWeapon(this.character.gear.equipped.weapon);
    if (this.carriedHerb) {
      // 맵을 옮겨도 약초 기운은 이어진다.
      this.herb = herbBonus(this.stats.maxHp);
      this.player.setMaxHp(this.stats.maxHp + this.herb, true);
    }
    // 마나: 처음에는 가득, 맵을 옮길 때는 이어 받는다.
    this.maxMp = this.derived.maxMp;
    this.mp = this.carriedMp !== undefined ? Phaser.Math.Clamp(this.carriedMp, 0, this.maxMp) : this.maxMp;
    // 공명 게이지는 저장해 두고, 공명 중에 맵을 옮기면 남은 시간을 이어 받는다.
    this.resonanceCharge = parseCharge(this.readResonanceSave(), RESONANCE);
    this.resonanceUntil = this.carriedResonance !== undefined ? this.now + Math.max(0, this.carriedResonance) : 0;
    if (this.carriedHp !== undefined) this.player.hp = Phaser.Math.Clamp(Math.round(this.carriedHp), 1, this.player.maxHp);
  }

  // ---------------------------------------------------------------- 맵 이동

  /** 발이 출구 영역에 들어가면 연결된 맵으로 옮겨 간다. 옮기기 시작했으면 true. */
  private checkExit(): boolean {
    const player = this.player;
    if (!player.alive) return false;
    const exit = findExit(this.map, player.x, player.y);
    if (!exit) return false;
    // 습격 중 광장에서는 바깥 사냥터로 나가지 못한다. 마을 북쪽(집들)으로는 갈 수 있다.
    if (chapterPhase(this.quests) === 'raid' && this.mapId === 'village' && exit.to !== 'village-north') return false;
    this.travel(exit);
    return true;
  }

  /** 화면을 어둡게 한 뒤 장면을 새 맵으로 다시 시작한다. 레벨·경험치는 저장되어 있어 그대로 이어진다. */
  /** revive: 쓰러진 뒤 다시 시작하는 이동. 체력·마나를 다 채워 도착한다. */
  private travel(exit: MapExit, revive = false): void {
    this.traveling = true;
    this.clearAttackInput();
    this.player.setMotion(false);
    this.attackButton.setVisible(false);
    this.talkMarker.setVisible(false);
    const data: SceneData = revive
      ? { map: exit.to, at: exit.arrive }
      : { map: exit.to, at: exit.arrive, hp: this.player.hp, herb: this.herb, mp: this.mp, resonance: Math.max(0, this.resonanceUntil - this.now) };
    const camera = this.cameras.main;
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart(data));
    camera.fadeOut(TRAVEL_FADE_MS, 0, 0, 0);
  }

  // ---------------------------------------------------------------- UI

  private buildUi(): void {
    // 포인터 수는 main.ts의 activePointers로 설정한다. 재시작 때 추가하지 않는다.
    this.joystick = new VirtualJoystick(this, {
      x: JOYSTICK_REST.x, y: VIEW_HEIGHT - JOYSTICK_REST.y,
      // 메뉴·창·대화·오프닝 중에는 그 아래 버튼을 누르는 것이므로 조이스틱을 잡지 않는다.
      canGrab: () => !this.menuOpen() && !this.opening,
    });

    createActionIcons(this);
    this.primaryAction = 'attack';
    this.suppressAttackUntilRelease = false;
    this.attackButton = new ActionButton(this, { x: 0, y: VIEW_HEIGHT - 170, label: '공격', fontSize: 22, icon: actionIcon('attack'), ignore: this.ignoreCombatPress });
    // 대화창은 화면 어디를 눌러도 넘어간다.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDialoguePointer, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onDialoguePointer, this);
    });
    this.dodgeButton = new ActionButton(this, {
      x: 0,
      y: VIEW_HEIGHT - 95,
      radius: BUTTON_RADIUS.dodge,
      label: '회피',
      icon: actionIcon('dodge'),
      cooldown: true,
      ignore: this.ignoreCombatPress,
      color: 0x2f4a86,
      fontSize: 24,
    });
    this.blockButton = new ActionButton(this, { x: 0, y: 0, radius: BUTTON_RADIUS.block, label: '막기', icon: actionIcon('block'), color: 0x5a6b7a, fontSize: 22, cooldown: true, ignore: this.ignoreCombatPress });
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

    const raid = chapterPhase(this.quests) === 'raid';
    this.hud = new Hud(this, raid && this.mapId === 'village' ? '마을 습격 · 권속을 저지하고 주민들의 안전을 확인하세요'
      : raid && this.mapId === 'village-north' ? '습격당한 마을 북쪽 · 길을 막은 권속을 물리치고 시아와 리네아를 찾으세요'
      : (fernMothHunt(this.quests) && this.mapId === 'south-field' ? '남쪽 들판 · 습격 뒤 남은 잿빛 나방이 날아다닙니다'
        : this.duskSpawns().length ? '해 질 무렵의 남쪽 들판 · 처음 보는 잿빛 나방이 날아다닙니다' : this.map.hint) + levelHint(this.mapId));
    this.drawHud();
  }

  private drawHud(): void {
    this.hud.setHp(this.player.hp, this.player.maxHp, this.herb);
    this.drawMp(true);
    this.drawOrbs();
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
      const b = outdoorArtBounds(this.map);
      camera.setBounds(b.left, b.top, b.right - b.left, b.bottom - b.top);
      return;
    }
    const { left, right, top, bottom } = interiorArtRect(interior);
    const viewW = this.scale.gameSize.width / camera.zoom, viewH = VIEW_HEIGHT / camera.zoom;
    const width = Math.max(right - left, viewW), height = Math.max(bottom - top, viewH);
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    camera.setBounds(cx - width / 2, cy - height / 2, width, height);
  }

  /** 게임을 멈추는 메뉴·창·대화가 열려 있는지 */
  private menuOpen(): boolean {
    return !!(this.quickSlotPanel?.isOpen || this.storyChoice?.isOpen || this.pauseMenu?.isOpen || this.itemPanel?.isOpen
      || this.characterPanel?.isOpen || this.worldMap?.isOpen || this.dialogue?.isOpen || this.deathPanel?.isOpen || this.guideCard?.isOpen);
  }

  private layout(): void {
    const { width } = this.scale.gameSize;
    if (this.map) this.setCameraBounds();
    this.hud.layout(width);
    // 전투 버튼 자리는 ui/buttonLayout.ts가 정한다(서로 겹치지 않음을 tools/button-layout.test.mjs가 검사).
    const buttons = combatButtonLayout(width, VIEW_HEIGHT, sizeScale(this.settings.buttonSize));
    this.joystick.setZone(joystickZone(width, VIEW_HEIGHT, sizeScale(this.settings.buttonSize)));
    this.attackButton.setPosition(buttons.attack.x, buttons.attack.y);
    this.dodgeButton.setPosition(buttons.dodge.x, buttons.dodge.y);
    this.blockButton?.setPosition(buttons.block.x, buttons.block.y);
    this.potionButton?.setPosition(buttons.items[0].x, buttons.items[0].y);
    this.lunchButton?.setPosition(buttons.items[1].x, buttons.items[1].y);
    this.resonanceButton?.setPosition(buttons.resonance.x, buttons.resonance.y);
    this.skillButtons.forEach((button, i) => button.setPosition(buttons.skills[i].x, buttons.skills[i].y));
    this.pauseButton.setPosition(width - 46, 74);
    this.characterButton?.setPosition(width - 46, 148);
    this.characterPanel?.layout(width);
    this.opening?.layout(width);
    // 미니맵은 일시정지 버튼 왼쪽, 퀘스트 목록은 그 아래에 오른쪽으로 맞춘다.
    this.minimap?.layout(width - 172, 92);
    if (this.minimap) this.questTracker?.layout(width - 20, this.minimap.bottom + 4);
    this.itemPanel?.layout(width);
    this.quickSlotPanel?.layout(width);
    this.worldMap?.layout(width);
    this.exitHint?.layout(width);
    this.dialogue.layout(width);
    this.storyChoice?.layout(width);
    this.deathPanel?.layout(width);
    this.bossHud?.layout(width);
    this.guideCard?.layout(width);
    this.drawChapterShade(width);
    this.festivalStage?.layout(width);
    this.pauseMenu.layout(width);
  }

  private drawChapterShade(width: number): void {
    this.chapterShade?.clear().fillStyle(0x122137, 0.42).fillRect(0, 0, width, VIEW_HEIGHT);
  }

  // ---------------------------------------------------------------- 이동

  private readInput(): Phaser.Math.Vector2 {
    // 오프닝 동안에는 감독이 정한 방향으로만 천천히 걷는다.
    if (this.opening) return this.input2.copy(this.openingInput).scale(this.cutsceneWalkScale);
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
    if (!this.attackButton.isDown && !this.attackKeys.some(key => key.isDown)) this.suppressAttackUntilRelease = false;
    const attackPressed = this.attackButton.consumePress() || this.keyboardAttackPressed;
    this.keyboardAttackPressed = false;
    let parryPressed = this.blockButton?.consumePress() ?? false;
    for (const key of this.blockKeys) if (Phaser.Input.Keyboard.JustDown(key)) parryPressed = true;
    this.blocking = false;
    // 오프닝 동안에는 공격·회피·막기를 받지 않는다.
    if (this.opening) {
      dodgePressed = false;
      parryPressed = false;
      this.attackBufferedUntil = undefined;
    }
    if (!player.alive) {
      this.attackBufferedUntil = undefined;
      return;
    }

    if (this.attackBufferedUntil !== undefined && time > this.attackBufferedUntil) {
      this.attackBufferedUntil = undefined;
    }
    if (attackPressed && !this.opening && !this.suppressAttackUntilRelease && this.primaryAction === 'attack') {
      this.attackBufferedUntil = time + PLAYER.attackBufferMs;
      if (player.sprite instanceof HeroSprite && player.sprite.isInFollowPause) {
        this.attackBufferedUntil = Math.max(this.attackBufferedUntil, this.nextAttackAt + 1);
      }
    }

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

    // 막기는 공격보다 우선한다. 공격·후딜·회전 베기의 남은 판정을 취소한다.
    this.blockButton?.setEnabled(time >= this.parryReadyAt);
    if (parryPressed && time >= this.parryReadyAt) {
      this.clearAttackInput();
      player.endAttack();
      this.attackTrace = undefined;
      this.attackLunge = undefined;
      this.spinHitAt = undefined;
      this.comboStage = 0;
      this.comboExpiresAt = 0;
      this.parryUntil = time + BLOCK.windowMs;
      this.parryReadyAt = time + BLOCK.cooldownMs;
      this.nextAttackAt = Math.max(this.nextAttackAt, this.parryUntil);
      this.dismissHint();
    }
    this.blocking = time < this.parryUntil && !player.isAttacking;

    // 초 단위 애니메이션과 밀리초 시계의 부동소수점 오차로 한 프레임 쉬지 않게 한다.
    if (!this.opening && !this.blocking && this.wantsAttack(time) && time + 1e-6 >= this.nextAttackAt) {
      this.startAttack(time, v.x, v.y);
      this.attackBufferedUntil = undefined;
    }

    const fromX = player.x;
    const fromY = player.y;
    // 공격 중에는 조이스틱으로 움직이지 않는다. 앞으로 나가는 것은 공격 자체의 전진(lunge)뿐이다.
    if (force > 0 && !player.isAttacking) {
      const speed = PLAYER_SPEED * (this.now < this.slowedUntil ? ASH_SLOW.speedScale : 1)
        * (this.blocking ? BLOCK.moveScale : 1) * resonanceSpeed(this.resonating, RESONANCE);
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
    for (const button of this.skillButtons) button.consumePress();
  }

  private wantsAttack(time = this.now): boolean {
    return this.primaryAction === 'attack' && !this.suppressAttackUntilRelease && (this.attackButton.isDown || this.attackKeys.some((key) => key.isDown) ||
      (this.attackBufferedUntil !== undefined && time <= this.attackBufferedUntil));
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

    const hero = player.sprite;
    const facing = dodgeFacingFor(input.x, input.y, hero instanceof HeroSprite ? hero.lookDirection : player.facing < 0 ? 'left' : 'right');
    const direction = attackVector(facing);
    this.dodgeDirection.set(direction.x, direction.y);
    player.face(direction.x);
    if (hero instanceof HeroSprite) hero.setAttackFacing(facing);

    this.dodgeUntil = time + DODGE.durationMs;
    this.dodgeProgress = 0;
    this.dodgeStartedAt = time;
    this.impacts.dust(player.x, player.y, 5, time, 50);
    this.dodgeOrigin.x = player.x;
    this.dodgeOrigin.y = player.y;
    this.justDodged = false;
    // 민첩(DEX)이 높을수록 회피를 빨리 다시 쓴다.
    this.dodgeReadyAt = time + DODGE.cooldownMs * this.derived.dodgeCooldown;
    this.questEvent({ type: 'dodge' });
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
    const strikeAt = strikePoseStart(trace.stage, rig.activeAttackFacing);
    // Keep updating the trail briefly through follow-through after the hit window closes.
    const visualEnd = end + 36;
    const visualSweep = attackBladeSweep(previous, current, lastElapsed, elapsed, strikeAt, visualEnd);
    if (elapsed >= visualEnd) this.attackTrace = undefined;
    if (visualSweep) {
      // 위쪽 3타 찌르기는 원근으로 짧은 칼 위에 빛줄기를 얹어야 보인다(칼은 몸 뒤, 빛줄기는 몸 앞).
      const upThrust = trace.stage === 2 && rig.activeAttackFacing === 'up';
      const behind = (rig.activeAttackFacing.startsWith('up') && !upThrust) || (trace.stage === 0
        && (rig.activeAttackFacing === 'left' || rig.activeAttackFacing === 'right'));
      trace.effect ??= this.effects.beginAttack(trace.stage, trace.startedAt + strikeAt, trace.startedAt + visualEnd,
        strikeAt, player.y + (behind ? -4 : 4), upThrust ? UP_THRUST_REACH : 1);
      // The samples stop at visualEnd, but the visible end must meet the displayed sword on that render.
      this.effects.drawAttack(trace.effect, visualSweep, time, current);
    }

    const sweep = attackBladeSweep(previous, current, lastElapsed, elapsed, strikeAt, end);
    if (!sweep) return;
    const finisher = trace.stage === PLAYER.combo.length - 1;
    let heaviest: Exclude<HitKind, 'hurt'> | undefined;
    for (const enemy of this.enemies) {
      const c = enemy.character;
      if (!c.alive || enemy.untouchable || trace.hit.has(enemy)) continue;
      // Use a corridor around the locked attack direction, then test the visible blade.
      if (!insideAttackLane(c.x - player.x, c.y - player.y, trace.direction,
        PLAYER.attackLane, VERTICAL_SPEED_RATIO)) continue;
      const bounds = c.sprite.getBounds(this.boundsScratch);
      // 정면 공격은 원근으로 짧게 그려진 칼 대신 판정 띠 안의 사거리로도 맞는다(PLAYER.frontReach).
      const frontHit = rig.activeAttackFacing === 'down'
        && insideFrontReach(c.y - player.y, PLAYER.frontReach[trace.stage], VERTICAL_SPEED_RATIO);
      if (!frontHit && !bladeHitsEllipse(sweep.previous, sweep.current, { x: bounds.centerX, y: bounds.centerY },
        bounds.width * 0.42 + PLAYER.bladeRadius, bounds.height * 0.42 + PLAYER.bladeRadius)) continue;
      trace.hit.add(enemy);
      // 서리 딱정벌레의 얼음 껍질: 정면에서 벤 칼은 튕겨 나간다(반격은 껍질을 뚫는다).
      if (this.shellBlocked(enemy, trace.counter, bounds.centerX, bounds.centerY)) continue;

      // 행운(LUK)만큼 치명타 확률이 오른다: 굴린 값을 그만큼 낮춘다.
      const strike = strikeKind(trace.counter, finisher, Math.random() - (this.derived.critChance - HIT_FEEL.critChance));
      heaviest = heavierKind(heaviest, strike.kind);
      const bonus = trace.counter ? JUST_DODGE.counterDamage : 1;
      const damage = monsterDamageTaken(Math.round(Phaser.Math.Between(this.stats.damageMin, this.stats.damageMax) * combo.damage * bonus * critMultiplier(strike.crit) * this.resonanceDamage()), enemy.stats.defense);
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

  /**
   * 서리 딱정벌레(monsterTypes의 shellBlocks)가 정면의 칼을 껍질로 막았으면 true. 막힌 자리에 차가운 불꽃과 "막힘"을 띄운다.
   * 피해·마나·밀림은 없다.
   */
  private shellBlocked(enemy: Enemy, counter: boolean, x: number, y: number): boolean {
    const c = enemy.character;
    if (!(c.sprite instanceof MonsterSprite)) return false;
    if (!shellBlocks(enemy.kind, c.sprite.facingVector(), this.player.x - c.x, this.player.y - c.y, counter)) return false;
    this.impacts.impact(x, y, Math.sign(c.x - this.player.x) || 1, 0, 'normal', this.now, c.y);
    this.progressEffects.showPopup(c.x, c.y - 140, '막힘', '#bfe8ff');
    return true;
  }

  /** 맞은 적의 뒤처리: 쓰러졌으면 경험치·퀘스트·전리품, 아니면 밀려나고 움찔한다. */
  private resolveEnemyHit(enemy: Enemy, died: boolean, dirX: number, dirY: number, push: number): void {
    const c = enemy.character;
    if (died) {
      enemy.kill();
      this.impacts.splatter(c.x, c.y, enemy.color, this.now);
      const raid = this.raidEnemies.has(enemy);
      if (!raid && enemy.kind !== 'swamp-lurker') this.enemyRespawns.push({ at: this.now + ENEMY.respawnMs, enemy });
      // 주인공이 몬스터보다 너무 높으면 경험치가 줄어든다.
      this.gainXp(xpForKill(enemy.stats.xp, enemy.level, this.progress.level), c.x, c.y - 185);
      this.questEvent({ type: 'kill', map: this.mapId, monster: enemy.kind, ...(raid ? { encounter: 'village-raid' as const } : {}) });
      if (!raid) this.collectDrop(c.x, c.y, enemy);
      if (enemy === this.boss) this.onBossDefeated(enemy);
    } else if (enemy.boss) {
      // 보스는 보통 공격에 움찔하지 않고 조금만 밀린다. 체력이 절반 아래로 떨어지면 포효하며 2페이즈.
      c.knockback.set(dirX * push * BOSS.knockbackScale, dirY * push * BOSS.knockbackScale * VERTICAL_SPEED_RATIO);
      enemy.onHit(this.now, this.walkArea, this.player);
      if (entersPhaseTwo(enemy.phase, c.hp, c.maxHp)) this.startBossRoar(enemy);
    } else {
      c.knockback.set(dirX * push, dirY * push * VERTICAL_SPEED_RATIO);
      enemy.interrupt(this.now);
      enemy.onHit(this.now, this.walkArea, this.player);
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
    this.potionButton?.setSizeScale(buttons);
    this.lunchButton?.setSizeScale(buttons);
    this.resonanceButton?.setSizeScale(buttons);
    for (const button of this.skillButtons) button.setSizeScale(buttons);
    this.joystick.setSizeScale(sizeScale(settings.joystickSize));
    this.justDodgeWindow = justDodgeWindowMs(settings.justDodgeTiming);
    if (this.pauseMenu) this.layout();
  }

  /** 뒤로가기 버튼: 메뉴가 열려 있으면 한 단계 뒤로, 아니면 일시정지. */
  private onBackButton(): void {
    if (this.opening) { this.opening.skip(); return; }
    if (this.deathPanel?.isOpen) { this.deathPanel.confirm(); return; }
    if (this.guideCard?.isOpen) { this.guideCard.close(); return; }
    if (this.quickSlotPanel?.isOpen) { this.quickSlotPanel.close(); return; }
    if (this.storyChoice?.isOpen) { this.storyChoice.cancel(); return; }
    if (this.pauseMenu.isOpen) this.pauseMenu.back();
    else this.openPause();
  }

  private openPause(): void {
    if (this.opening || this.deathPanel?.isOpen || this.guideCard?.isOpen) return;
    if (this.storyChoice?.isOpen || this.quickSlotPanel?.isOpen) return;
    if (!this.pauseMenu || this.pauseMenu.isOpen) return;
    this.pauseButton.setVisible(false);
    this.characterButton?.setVisible(false);
    this.setQuickButtonsVisible(false);
    this.pauseMenu.open();
  }

  /** 메뉴를 닫을 때 메뉴를 누르던 입력이 공격·회피·대화로 이어지지 않게 비운다. */
  private onResume(): void {
    this.attackButton.setVisible(true);
    this.suppressAttackUntilRelease = true;
    this.pauseButton.setVisible(true);
    this.characterButton?.setVisible(true);
    this.characterButton?.consumePress();
    this.clearAttackInput();
    this.dodgeButton.consumePress();
    this.pauseButton.consumePress();
    this.clearQuickItemInput();
    for (const key of [...this.dodgeKeys, ...this.talkKeys, ...this.attackKeys, ...this.mapKeys]) Phaser.Input.Keyboard.JustDown(key);
  }

  // ---------------------------------------------------------------- 대화

  /** E·Enter 보조 상호작용 키의 눌림을 한 번만 센다. */
  private talkPressed(): boolean {
    let pressed = false;
    for (const key of this.talkKeys) {
      if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    }
    return pressed;
  }

  private onDialoguePointer(pointer?: Phaser.Input.Pointer): void {
    if (!this.dialogue.isOpen || this.pauseMenu.isOpen) return;
    // 이 누름은 대화를 넘기는 데 썼다. 같은 누름이 그 자리의 전투 버튼(공명·막기 등)으로 이어지지 않게 적어 둔다.
    if (pointer) this.dialogueTap = { id: pointer.id, downTime: pointer.downTime };
    this.dialogue.advance();
  }

  /**
   * 전투 버튼이 이 누름을 받지 않을지: 대화·메뉴·창이 열려 있거나, 대화를 넘기거나 닫은 바로 그 누름일 때.
   * 버튼과 대화의 누름 처리 순서가 정해져 있지 않아, 마지막 줄을 닫은 누름이 버튼에 먼저 닿지 않아도 막는다.
   */
  private readonly ignoreCombatPress = (pointer: Phaser.Input.Pointer): boolean =>
    this.menuOpen() || (this.dialogueTap?.id === pointer.id && this.dialogueTap.downTime === pointer.downTime);

  /** 싸우는 중에는 말을 걸 수 없다. 대화 중에는 게임이 멈추므로 공격받는 도중에 열리지 않게 한다. */
  private inCombat(): boolean {
    return this.enemies.some((e) => e.state === 'chase' || e.state === 'windup' || e.state === 'recover' || e.state === 'roar' || e.state === 'retreat' || e.state === 'volley' || e.state === 'veil');
  }

  private setPrimaryAction(action: ActionIcon, label: string): void {
    if (this.primaryAction === action) return;
    this.primaryAction = action;
    const icon = actionIcon(action);
    this.attackButton.setLabel(label);
    this.attackButton.setIcon(icon.texture, icon.frame);
  }

  /** 대상을 먼저 찾아 주 행동 버튼을 전환하고, 전투 입력을 받기 전에 상호작용을 처리한다. */
  private updateInteraction(time: number): void {
    const player = this.player;
    if (this.opening) {
      this.attackButton.setVisible(false);
      this.talkMarker.setVisible(false);
      this.talkPressed();
      return;
    }
    const free = player.alive && !player.isAttacking && this.dodgeProgress >= 1 && !this.inCombat();
    const target = free ? findInteractable(player.x, player.y, this.interactables) : undefined;
    this.attackButton.setVisible(true);
    if (!target) this.setPrimaryAction('attack', '공격');

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
    const observingPatient = target.id === 'npc-linea' && !chapterCanTalk('linea', this.quests);
    const action: ActionIcon = leaving ? 'exit' : enter ? 'enter' : target.id.startsWith('story-') || observingPatient ? 'inspect' : target.id.startsWith('rest-') ? 'rest' : target.id.startsWith('heal-') ? 'heal' : 'talk';
    this.setPrimaryAction(action, leaving ? '나가기' : enter ? '들어가기' : action === 'inspect' ? '살펴보기' : action === 'rest' ? '쉬기' : action === 'heal' ? '치료받기' : '대화');
    marker.setText(leaving ? '▼ 나가기' : enter ? `▲ ${enter.label}` : '···');

    const pressed = this.attackButton.consumePress() || this.keyboardAttackPressed;
    const talk = this.talkPressed();
    if (pressed || this.attackButton.isDown || this.attackKeys.some(key => key.isDown)) this.suppressAttackUntilRelease = true;
    this.clearAttackInput();
    if (!pressed && !talk) return;
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
      this.dialogue.open(INSPECTION_LINES[target.id] ?? CHAPTER_TWO_INSPECTIONS[target.id] ?? [], () => {
        const spot = target.id.slice('story-'.length) as InspectSpot;
        this.questEvent({ type: 'inspect', spot, map: this.mapId });
        this.onResume();
      });
      return;
    }
    const beforePhase = chapterPhase(this.quests);
    const player = this.player;
    // 말을 건 사람만 걷던 것을 멈추고 이쪽을 본다.
    this.npcs.find(npc => npc.spot === target)?.talkedTo(this.now, player);
    this.hud.dismissHint();
    this.clearAttackInput();
    player.setMotion(false, target.x - player.x);
    this.attackButton.setVisible(false);
    this.talkMarker.setVisible(false);
    // 마을 사람이면 퀘스트 대화를 먼저 본다. 퀘스트와 상관없으면 평소 대사.
    const npc = target.id.startsWith('npc-') ? target.id.slice(4) as NpcId : undefined;
    const quest = npc && chapterCanTalk(npc, this.quests) ? talkTo(npc, this.quests) : undefined;
    const lines = quest?.lines.length ? quest.lines
      : (npc && (chapterTwoDialogue(npc, this.quests) ?? chapterDialogue(npc, this.quests))) || (target.dialogue ? DIALOGUES[target.dialogue] : []);
    this.dialogue.open(lines, () => {
      if (quest) {
        this.quests = quest.state;
        this.saveQuests();
        this.refreshQuests();
      }
      // 단계 보상: 이 대화로 마친 단계가 기술을 가르쳐 주면 배운다(떠날 채비의 루안).
      if (quest?.stepDone?.rewardSkill) this.learnSkill(quest.stepDone.rewardSkill);
      // 그 자리에서 하룻밤을 보내는 단계(고개의 쉼터): 화면이 어두워졌다 밝아지며 쉰다.
      if (quest?.stepDone?.night) this.spendNight('shelter');
      if (quest?.completed) {
        this.hud.showCallout(`퀘스트 완료: ${quest.completed.title}${quest.next ? ` → ${quest.next.title}` : ''}`);
        this.gainXp(quest.completed.rewardXp, player.x, player.y - 185);
        this.giveRewards(quest.completed.rewardGold ?? 0, quest.completed.rewardItems ?? [], quest.completed.rewardGear ?? []);
        if (quest.completed.rewardSkill) this.learnSkill(quest.completed.rewardSkill);
      } else if (quest?.accepted) {
        this.hud.showCallout(`새 퀘스트: ${quest.accepted.title}`);
      } else if (quest?.progressed) {
        const p = this.quests[quest.progressed.id]!;
        this.hud.showCallout(`${quest.progressed.title}: ${p.status === 'ready' ? '보고하러 가기' : currentObjective(quest.progressed, p).label}`);
      }
      // 메리나와의 평소 대화가 끝나면 잡화점을 연다.
      if (!quest && target.id === 'npc-merina') this.openItemPanel('shop');
      // 페른: "남문의 수레"를 끝낸 대화 뒤, 그리고 그 뒤의 평소 대화 뒤에 수레(상점)를 연다.
      if (target.id === 'npc-fern' && fernShopOpen(this.quests) && (!quest || quest.completed?.id === 'fern-cart')) this.openItemPanel('shop', 'fern');
      // 도란과 대화가 끝나면 대장간(장비 구매·판매)을 연다. 퀘스트를 막 받거나 끝낸 대화 뒤에는 열지 않는다
      // (진행 중인 퀘스트를 다시 일러 주는 대화 뒤에는 연다. 그러지 않으면 퀘스트 동안 장비를 못 산다).
      if (!quest?.accepted && !quest?.completed && target.id === 'npc-doran') this.openCharacterPanel('items', true);
      // 로제타와의 평소 대화가 끝나면 쉬어 갈지 묻는다 (습격의 밤에는 묻지 않는다).
      // 치유소의 에일라와 평소 대화가 끝나면 치료해 줄지 묻는다.
      if (!quest && target.id === 'npc-eila' && this.mapId === 'in-clinic') {
        this.storyChoice?.open(() => this.healAtClinic(), {
          title: '에일라의 치료',
          text: '다친 데가 있으면 봐 줄게.',
          summary: '체력·마나 모두 회복 · 잿빛 둔화 해제\n약초 기운: 처음 맞을 때까지 최대 체력 +10%',
          yes: '치료받기', no: '괜찮아요',
        });
      }
      if (!quest && target.id === 'npc-dor' && shelterRestOpen(this.quests)) {
        this.storyChoice?.open(() => this.rest('shelter'), {
          title: '고개 쉼터에서 쉬어 가기',
          text: '도르가 모닥불에 장작을 한 아름 더 얹는다.',
          summary: `체력 회복  ·  ${this.player.hp} / ${this.player.maxHp} → ${this.player.maxHp} / ${this.player.maxHp}\n다음 시작 위치  ·  동쪽 고갯길 고개 쉼터`,
          hint: '휴식은 무료이며 퀘스트 진행과 시간대는 바뀌지 않습니다.',
          yes: '쉬어 가기', no: '돌아가기',
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
        // 잔치가 시작되면 광장에서 수확제 연출을 본다.
        if (chapterPhase(this.quests) === 'raid') {
          try { this.storage?.setItem(FESTIVAL_SAVE_KEY, 'pending'); } catch { /* 저장소가 막혀 있으면 연출 없이 습격으로 */ }
        }
        const at = mapPoint({ x: 1180, y: 1130 });
        this.travel({ to: 'village', arrive: at, zone: { left: 0, top: 0, right: 0, bottom: 0 }, label: '', labelAt: at });
      }
    });
  }

  /**
   * 그 자리에서 하룻밤을 보낸다: 화면이 어두워지는 동안 게임을 멈추고(traveling), 쉬고(rest), 다시 밝힌다.
   * 화면 페이드는 보이는 연출뿐이라 카메라의 실시간 효과를 쓴다(게임 시계와 상관없다).
   */
  private spendNight(id: RestPointId): void {
    const camera = this.cameras.main;
    this.traveling = true;
    this.player.setMotion(false, 0);
    camera.fadeOut(NIGHT_FADE_MS, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!this.scene.isActive()) return;
      this.rest(id, '고개의 쉼터에서 하룻밤을 보냈다 · 다음 날 아침');
      camera.fadeIn(NIGHT_FADE_MS, 0, 0, 0);
      this.traveling = false;
    });
  }

  /** 쉬기: 체력을 채우고 다음 시작 자리로 저장한다. */
  private rest(id: RestPointId, callout?: string): void {
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
    this.hud.showCallout(callout ?? `푹 쉬었다 · 다음에는 ${REST_POINTS[id].name}에서 시작한다`);
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
  /**
   * 습격의 다음 무리: 지금 단계에 이 맵에 나올 권속이 있고 살아 있는 권속이 없으면 소환한다.
   * 장면을 만들 때와, 대화·처치로 퀘스트 단계가 바뀔 때마다 부른다.
   */
  private syncRaidEnemies(announce = true): void {
    // 축제 연출 동안에는 싸울 무리를 내지 않는다(연출이 끝나면 광장을 다시 열면서 나온다).
    if (this.playFestival) return;
    if ([...this.raidEnemies].some((e) => e.character.alive && e.state !== 'dead') || this.bossWarningEnd !== undefined) return;
    const spawns = raidSpawns(this.quests, this.mapId);
    if (spawns.length === 0) return;
    // 보스는 "보스 등장" 경고를 띄운 뒤 나타난다(updateBoss).
    if (spawns.some((s) => s.boss)) {
      this.pendingBoss = spawns;
      this.bossWarningEnd = this.now + BOSS.warningMs;
      this.bossHud?.showWarning(MONSTERS[spawns.find((s) => s.boss)!.key].name, this.now);
      // 결계는 다음 프레임(updateBoss)에 연다: 장면을 만드는 중이면 아직 병사와 HUD가 없다.
      this.arena = undefined;
      this.cameras.main.shake(BOSS.warningMs * 0.3, 0.003);
      return;
    }
    for (const point of spawns) {
      const enemy = new Enemy(this, point.key, point.x, point.y, point.level);
      this.enemies.push(enemy);
      this.raidEnemies.add(enemy);
    }
    if (announce) this.hud.showCallout('권속이 몰려온다!');
  }

  private refreshQuests(): void {
    if (this.player) this.syncRaidEnemies();
    this.interactables = this.interactables.filter(spot => !spot.id.startsWith('story-'));
    for (const marker of this.storyMarkers) marker.destroy();
    this.storyMarkers = [];
    for (const spot of [...chapterSpots(this.quests, this.mapId), ...chapterTwoSpots(this.quests, this.mapId)]) {
      this.interactables.push(spot);
      this.storyMarkers.push(this.add.text(spot.x, spot.y - spot.markerHeight, '◆ 살펴보기', {
        fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#ffd23f', stroke: '#1a1008', strokeThickness: 5,
      }).setOrigin(0.5, 1).setDepth(spot.y + 400).setResolution(2));
    }
    for (const npc of this.npcs) {
      this.syncDefenderRecovery(npc);
      const recovery = npc.def.id === 'linea' ? lineaRecovery(this.quests) : undefined;
      if (recovery && npc.currentStoryAction !== recovery) npc.setStoryAction(recovery);
      npc.setQuestMarker(this.playFestival || !chapterCanTalk(npc.def.id, this.quests) ? undefined : markerFor(npc.def.id, this.quests));
    }
    for (const door of this.doorMarkers) {
      const markers = door.npcs.filter(id => chapterCanTalk(id, this.quests)).map((id) => markerFor(id, this.quests)).filter((m): m is QuestMarker => !!m);
      door.marker = MARKER_PRIORITY.find((m) => markers.includes(m));
      if (door.marker) door.text.setText(MARKER_STYLE[door.marker].text).setColor(MARKER_STYLE[door.marker].color);
      door.text.setVisible(!!door.marker);
    }
    this.questTracker?.refresh(this.quests);
    this.syncSerenaEvacuation();
  }

  /** The safety conversation sends Serena north immediately, without waiting for a map reload. */
  private syncSerenaEvacuation(): void {
    if (this.playFestival || this.mapId !== 'village' || chapterPhase(this.quests) !== 'raid'
      || (this.quests['village-raid']?.step ?? 0) < 4) return;
    const npc = this.npcs.find(n => n.def.id === 'serena');
    const exit = this.map.exits.find(e => e.to === 'village-north');
    if (!npc || !exit) return;
    if (!this.departingNpcs.has(npc)) {
      const destination = { x: (exit.zone.left + exit.zone.right) / 2, y: exit.zone.bottom - 20 };
      const path = npcExitPath(npc, destination, this.map.bounds, (x, y) => this.walkArea.contains(x, y));
      if (path.length === 0) return;
      npc.setStoryAction();
      npc.walkTo(path, 1.25);
      this.departingNpcs.add(npc);
    }
    npc.setQuestMarker(undefined);
    this.interactables = this.interactables.filter(spot => spot !== npc.spot);
  }

  private finishSerenaEvacuation(): void {
    if (this.departingNpcs.size === 0) return;
    const exit = this.map.exits.find(e => e.to === 'village-north');
    if (!exit) return;
    const { left, top, right, bottom } = exit.zone;
    for (const npc of this.departingNpcs) {
      if (npc.x < left || npc.x > right || npc.y < top || npc.y > bottom) continue;
      this.departingNpcs.delete(npc);
      this.npcs = this.npcs.filter(n => n !== npc);
      npc.destroy();
    }
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

  /** 실제 게임 시계와 성공 시 초기화된 기한을 표시에도 그대로 반영한다. */
  private updateCombatCooldowns(time: number): void {
    this.dodgeButton.setEnabled(time >= this.dodgeReadyAt);
    this.dodgeButton.setCooldown(Math.max(0, this.dodgeReadyAt - time), DODGE.cooldownMs * this.derived.dodgeCooldown);
    this.blockButton?.setEnabled(time >= this.parryReadyAt);
    this.blockButton?.setCooldown(Math.max(0, this.parryReadyAt - time), BLOCK.cooldownMs);
    this.skillSlots.forEach((skill, i) => {
      if (skill === 'spin') this.skillButtons[i]?.setCooldown(Math.max(0, this.nextSpinAt - time), SPIN_SLASH.cooldownMs);
    });
  }

  // ---------------------------------------------------------------- 마나와 회전 베기

  /** 마나가 저절로 차고, 스킬 버튼(또는 K)으로 회전 베기를 쓴다. 맞히는 순간도 여기서 처리한다. */
  private updateSkill(time: number, gameStep: number): void {
    const player = this.player;
    if (player.alive) this.mp = regenMana(this.mp, this.maxMp, gameStep);
    if (this.spinHitAt !== undefined && time >= this.spinHitAt) {
      this.spinHitAt = undefined;
      if (player.alive) this.spinHit();
    }
    const ready = player.alive && time >= this.nextSpinAt && !player.isAttacking && !this.blocking && time >= this.dodgeUntil
      && this.spinHitAt === undefined;
    const enough = this.mp >= SPIN_SLASH.cost;
    this.skillButtons.forEach((button, i) => {
      let pressed = button.consumePress();
      const key = this.skillKeys[i];
      if (key && Phaser.Input.Keyboard.JustDown(key)) pressed = true;
      const skill = this.skillSlots[i];
      // 빈 칸은 눌러도 아무 일도 없다.
      if (skill !== 'spin') return;
      button.setEnabled(ready && enough);
      if (!pressed || this.opening) return;
      if (ready && enough) this.startSpin(time);
      else if (ready) this.hud.showCallout('마나가 부족하다');
    });
    this.drawMp();
  }

  // ---------------------------------------------------------------- 공명

  private get resonating(): boolean {
    return this.now < this.resonanceUntil;
  }

  /** 공명 중 주는 피해 배율 */
  private resonanceDamage(): number {
    return this.resonating ? RESONANCE.damageScale : 1;
  }

  private setResonanceCharge(charge: number): void {
    if (charge === this.resonanceCharge) return;
    this.resonanceCharge = charge;
    try { this.storage?.setItem(RESONANCE_SAVE_KEY, String(charge)); } catch { /* 저장이 막혀도 게임은 계속한다 */ }
    this.drawOrbs();
  }

  private readResonanceSave(): string | null {
    try { return this.storage?.getItem(RESONANCE_SAVE_KEY) ?? null; } catch { return null; }
  }

  private drawOrbs(): void {
    this.hud.setOrbs(orbFill(this.resonanceCharge, RESONANCE), this.resonating);
  }

  /** 공명 버튼(또는 F): 구슬 하나를 쓰고 durationMs 동안 강해진다. 남은 시간은 버튼의 원형 대기로 보인다. */
  private updateResonance(time: number): void {
    const button = this.resonanceButton;
    if (!button) return;
    let pressed = button.consumePress();
    for (const key of this.resonanceKeys) if (Phaser.Input.Keyboard.JustDown(key)) pressed = true;
    const wasActive = this.resonanceAura?.visible ?? false;
    const active = this.resonating;
    const ready = this.player.alive && !this.opening && canResonate(this.resonanceCharge, RESONANCE, active);
    if (pressed && ready) {
      this.resonanceUntil = time + RESONANCE.durationMs;
      this.setResonanceCharge(this.resonanceCharge - RESONANCE.cost);
      this.questEvent({ type: 'resonance' });
      this.hud.showCallout('공명!');
      this.cameras.main.flash(160, 255, 215, 120);
      this.impacts.dust(this.player.x, this.player.y, 8, time, 60);
    } else if (pressed && !active) {
      this.hud.showCallout('공명 구슬이 모자라다');
    }
    const on = this.resonating;
    button.setEnabled(on || ready);
    button.setCooldown(on ? this.resonanceUntil - time : 0, RESONANCE.durationMs);
    const aura = this.resonanceAura;
    if (aura) {
      aura.setVisible(on);
      if (on) aura.setPosition(this.player.x, this.player.y).setDepth(this.player.depth - 1)
        .setAlpha(0.65 + 0.35 * Math.sin(time / 120));
    }
    if (on !== wasActive) this.drawOrbs();
  }

  /** 기술 칸의 글자: 빈 칸은 비워 두고 흐리게, 기술이 든 칸은 이름 한 줄(작은 칸이라 대기 초와 겹치지 않게). */
  private refreshSkillButtons(): void {
    this.skillButtons.forEach((button, i) => {
      const skill = this.skillSlots[i];
      button.setLabel(skill ? SKILLS[skill].label : '');
      if (!skill) button.setEnabled(false);
    });
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
      if (!c.alive || enemy.untouchable) continue;
      const dx = c.x - player.x, dy = c.y - player.y;
      if (!inSpinRadius(dx, dy, SPIN_SLASH.radius, VERTICAL_SPEED_RATIO)) continue;
      hits++;
      const spinBounds = c.sprite.getBounds(this.boundsScratch);
      if (this.shellBlocked(enemy, false, spinBounds.centerX, spinBounds.centerY)) continue;
      const length = Math.hypot(dx, dy / VERTICAL_SPEED_RATIO) || 1;
      const dirX = dx / length, dirY = dy / VERTICAL_SPEED_RATIO / length;
      const damage = monsterDamageTaken(Math.round(Phaser.Math.Between(this.stats.damageMin, this.stats.damageMax) * SPIN_SLASH.damage * this.derived.skillDamage * this.resonanceDamage()), enemy.stats.defense);
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
    if (this.opening) pressed = false;
    const player = this.player;
    const ready = time >= this.nextUseAt && player.alive && !!id && countOf(this.inventory, id) > 0 && canUse(id, this.useStatus());
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
    if (this.opening) visible = false;
    this.potionButton?.setVisible(visible);
    this.lunchButton?.setVisible(visible);
  }

  /**
   * 물약 칸과 함께 막기·공명 버튼의 쌓인 눌림도 비운다. 대화를 넘기거나 창을 닫으려고 화면을 누른 자리가
   * 이 버튼들 위였으면, 닫힌 뒤 막기나 공명이 저절로 쓰이지 않게 한다.
   */
  private clearQuickItemInput(): void {
    this.potionButton?.consumePress();
    this.lunchButton?.consumePress();
    this.blockButton?.consumePress();
    this.resonanceButton?.consumePress();
    for (const key of [...this.blockKeys, ...this.resonanceKeys]) Phaser.Input.Keyboard.JustDown(key);
    for (const key of this.potionKeys) Phaser.Input.Keyboard.JustDown(key);
    for (const key of this.lunchKeys) Phaser.Input.Keyboard.JustDown(key);
  }

  /** 아이템을 쓸 때의 몸 상태 (체력·마나·느려짐) */
  private useStatus(): UseStatus {
    const player = this.player;
    return { hp: player.hp, maxHp: player.maxHp, mp: this.mp, maxMp: this.maxMp, slowed: this.now < this.slowedUntil };
  }

  /** 소모품을 쓴다: 체력·마나를 채우고 느려짐을 푼다. 효과가 없으면 쓰지 않는다. */
  private useHealItem(id: ItemId): boolean {
    const player = this.player;
    const result = useConsumable(this.inventory, id, this.useStatus());
    if (!result || this.now < this.nextUseAt) return false;
    this.inventory = result.inventory;
    this.nextUseAt = this.now + USE_COOLDOWN_MS;
    player.hp += result.heal;
    if (result.heal > 0) this.showDamage(player.x, player.y - 190, result.heal, '#7dff8a', 38);
    if (result.mana > 0) {
      this.mp = Math.min(this.maxMp, this.mp + result.mana);
      this.showDamage(player.x, player.y - (result.heal > 0 ? 230 : 190), result.mana, '#7fc8ff', 38);
      this.drawMp();
    }
    if (result.cured) {
      this.slowedUntil = 0;
      this.hud.showCallout('몸이 가벼워졌다');
    }
    this.impacts.dust(player.x, player.y, 3, this.now, 30);
    this.drawHud();
    this.saveInventory();
    this.refreshInventory();
    this.questEvent({ type: 'item' });
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

  private giveRewards(gold: number, items: Array<{ id: ItemId; count: number }>, gear: GearId[] = []): void {
    if (gold === 0 && items.length === 0 && gear.length === 0) return;
    this.inventory = addGold(this.inventory, gold);
    for (const item of items) this.inventory = addItem(this.inventory, item.id, item.count);
    if (gear.length) {
      // 보상 장비는 가방에 들어간다. 장비 창에서 낀다.
      for (const id of gear) this.character = { ...this.character, gear: addGear(this.character.gear, id) };
      this.saveCharacter();
    }
    const player = this.player;
    const labels = [gold ? `+${gold} G` : '', ...items.map((i) => `${ITEMS[i.id].name} +${i.count}`), ...gear.map((id) => `${GEAR[id].name} 획득`)].filter(Boolean);
    labels.forEach((label, i) => this.progressEffects.showPopup(player.x, player.y - 150 + i * 28, label, i === 0 && gold ? '#ffd23f' : '#a8f0ff'));
    this.saveInventory();
    this.refreshInventory();
  }

  /** 전체 지도를 연다. 대화·메뉴·이동 중에는 열지 않는다. */
  private openWorldMap(): void {
    if (this.opening) return;
    if (!this.worldMap || this.quickSlotPanel?.isOpen || this.storyChoice?.isOpen || this.worldMap.isOpen || this.dialogue.isOpen || this.pauseMenu.isOpen || this.itemPanel?.isOpen || this.characterPanel?.isOpen || this.traveling) return;
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.attackButton.setVisible(false);
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
      if (player.sprite instanceof HeroSprite) player.sprite.setWeapon(this.character.gear.equipped.weapon);
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
      slowed: this.now < this.slowedUntil,
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
    if (this.opening) return;
    if (!this.characterPanel || this.characterPanel.isOpen || this.traveling || this.pauseMenu.isOpen || this.dialogue.isOpen
      || this.itemPanel?.isOpen || this.worldMap?.isOpen || this.storyChoice?.isOpen || this.quickSlotPanel?.isOpen) return;
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.attackButton.setVisible(false);
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

  /** 가방이나 상점을 연다. 상점이면 shop이 파는 물건을 보여 준다. */
  private openItemPanel(mode: 'bag' | 'shop', shop: ShopId = 'merina'): void {
    this.shopId = shop;
    this.setQuickButtonsVisible(false);
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.attackButton.setVisible(false);
    this.talkMarker.setVisible(false);
    this.pauseButton.setVisible(false);
    this.characterButton?.setVisible(false);
    this.itemPanel?.show(mode, this.inventory, shop);
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
      const before = this.useStatus();
      const used = this.useHealItem(action.id);
      const def = ITEMS[action.id];
      const gained = [this.player.hp > before.hp ? `체력 +${this.player.hp - before.hp}` : '',
        this.mp > before.mp ? `마나 +${Math.round(this.mp - before.mp)}` : '', before.slowed && this.now >= this.slowedUntil ? '느려짐 해소' : ''].filter(Boolean).join(' · ');
      // 효과가 없어 쓰지 않았을 때: 체력 회복 물건이면 체력이 가득하다고, 아니면 지금은 효과가 없다고 알린다.
      const full = def.heal && !def.mana && !def.cures && before.hp >= before.maxHp;
      this.itemPanel?.setStatus(used ? `${def.name} 사용 · ${gained}`
        : full ? '체력이 가득 차 있어요. 물품은 사용하지 않았습니다.' : '지금은 이 물품을 사용할 수 없어요.', !used);
      this.itemPanel?.refresh(this.inventory);
      if (this.characterPanel?.isOpen) {
        this.characterPanel.setStatus(used ? `${def.name} 사용 · ${gained}`
          : full ? '체력이 가득 차 있어요.' : '지금은 사용할 수 없어요.', !used);
        this.characterPanel.refresh(this.characterView());
      }
      return;
    }
    if (action.type === 'buy') next = buy(this.inventory, action.id, 1, this.shopId);
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
    button?.setLabel(id ? `${ITEMS[id].name.replace('회복 ', '')} ${countOf(this.inventory, id)}` : '등록');
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
      ...[...this.npcs, ...(this.companion ? [this.companion] : [])].filter((n) => n.visible).map((n) => ({ x: n.x, y: n.y, marker: n.questMarker })),
      ...this.doorMarkers.filter((d) => d.marker).map((d) => ({ x: d.spot.x, y: d.spot.y, marker: d.marker })),
      ...[...chapterSpots(this.quests, this.mapId), ...chapterTwoSpots(this.quests, this.mapId)].map(spot => ({ x: spot.x, y: spot.y, marker: 'target' as const })),
    ],
    enemies: this.enemies.filter((e) => e.character.alive).map((e) => ({ x: e.character.x, y: e.character.y })),
  });

  /** 몬스터의 돌진이 닿는 순간. 화살표 함수라서 콜백으로 그대로 넘길 수 있다. */
  private readonly onEnemyStrike = (enemy: Enemy, hit?: EnemyHit): boolean => {
    const player = this.player;
    const c = enemy.character;
    const now = this.now;
    if (!player.alive || this.dialogue.isOpen) return false;
    const reaches = (x: number, y: number) => hit
      ? enemyHitReaches(hit, x, y) && (enemy.kind !== 'swamp-lurker' || this.walkArea.hasClearPath(hit.fromX, hit.fromY, x, y, 4))
      : strikeReaches(c.x, c.y, c.facing, x, y);
    if (!reaches(player.x, player.y)) {
      const defender = [...this.npcs, ...this.companionFighters()].filter(npc => npc.canFight && reaches(npc.x, npc.y))
        .sort((a, b) => Math.hypot(a.x-c.x, a.y-c.y)-Math.hypot(b.x-c.x, b.y-c.y))[0];
      if (defender) {
        const source = hit ? { x: defender.x-hit.dx, y: defender.y-hit.dy } : c;
        const result = defender.receiveCombatHit(now, source, enemy.stats.damage * (hit?.damageScale ?? 1));
        if (result === 'injured' && this.npcs.includes(defender)) this.syncDefenderRecovery(defender);
        if (result !== 'miss') {
          this.impacts.impact(defender.x, defender.y-65, Math.sign(c.x-defender.x), 0,
            result === 'blocked' ? 'counter' : 'normal', now, defender.y+2);
          if (result === 'blocked' && !hit) enemy.interrupt(now, NPC_COMBAT.blockStunMs);
          return true;
        }
      }
    }

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
      // 들어 올린 검날에서 불꽃이 튀고 다음 공격은 반격이 된다.
      const blade = player.sprite instanceof HeroSprite ? player.sprite.getBlade() : undefined;
      const x = blade ? blade.base.x + (blade.tip.x - blade.base.x) * 0.55 : player.x + player.facing * 60;
      const y = blade ? blade.base.y + (blade.tip.y - blade.base.y) * 0.55 : player.y - 95;
      this.impacts.impact(x, y, -player.facing, 0, 'counter', now, player.y + 2);
      this.hud.showCallout('패링!');
      // 패링마다 공명 구슬이 1/3씩 찬다.
      this.setResonanceCharge(chargeOnParry(this.resonanceCharge, RESONANCE));
      enemy.interrupt(now, BLOCK.stunMs);
      this.focusCompanion(enemy);
      this.counterUntil = now + JUST_DODGE.counterMs;
      this.parryUntil = 0;
      this.parryReadyAt = now;
      this.questEvent({ type: 'parry' });
      // 패링에 성공하면 회피 대기 시간도 줄어든다.
      this.dodgeReadyAt = Math.max(now, this.dodgeReadyAt - BLOCK.dodgeRefundMs);
      this.cameras.main.shake(70, 0.002);
      this.cameras.main.flash(90, 190, 215, 255);
      this.hitStop('counter');
      return true;
    }
    // 방어력(DEF)만큼 받는 피해가 줄어든다.
    // 공명 중에는 받는 피해가 더 준다(최소 1).
    // 보스의 부식 산탄처럼 공격마다 배율(damageScale)이 다를 수 있다.
    const { taken, died } = this.hurtPlayer(enemy, enemy.stats.damage * (hit?.damageScale ?? 1), enemy.stats.name);
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

  /**
   * 주인공이 피해를 받는다: 방어력(DEF)과 공명을 반영하고(최소 1), 받은 피해를 기록하고, 약초 기운을 지운다.
   * source: 쓰러졌을 때의 창에 보일 이름
   */
  private hurtPlayer(enemy: Enemy, damage: number, source: string): { taken: number; died: boolean } {
    const player = this.player;
    const taken = resonanceTaken(mitigate(Math.round(damage), this.derived), this.resonating, RESONANCE);
    const died = player.hurt(taken, 0xff5a4a);
    this.damageLog = recordDamage(this.damageLog, { name: source, level: enemy.level }, taken);
    if (this.herb) {
      // 약초 기운은 처음 맞을 때 사라진다. 남은 체력이 기본 최대보다 많으면 기본 최대로 맞춘다.
      this.herb = 0;
      player.setMaxHp(this.stats.maxHp, false);
      if (!died) this.hud.showCallout('약초 기운이 사라졌다');
    }
    return { taken, died };
  }

  /**
   * 보스 2페이즈의 부식: 웅덩이 틱(작은 피해와 짧은 둔화, 무적 시간을 주지 않는다)과
   * 부식의 장막(터질 때 범위 안이면 큰 피해와 넉백). 회피 무적 중에는 받지 않고, 패링으로는 막지 못한다.
   */
  private readonly onBossHazard = (enemy: Enemy, kind: 'pool' | 'veil', hit: boolean, dirX: number, dirY: number): void => {
    const player = this.player, now = this.now;
    if (kind === 'veil') {
      this.cameras.main.shake(320, 0.012);
      this.impacts.screenFlash(0x8a2bd0, 0.18, 260);
    }
    if (!hit || !player.alive || now < player.invulnerableUntil || this.dialogue.isOpen) return;
    const veil = kind === 'veil';
    const scale = veil ? BOSS.veil.damageScale : BOSS.pool.damageScale;
    const { taken, died } = this.hurtPlayer(enemy, enemy.stats.damage * scale, `${enemy.stats.name}(${veil ? '부식의 장막' : '부식 웅덩이'})`);
    this.showDamage(player.x, player.y - 190, taken, veil ? '#ff8a7a' : '#c9a3e6');
    if (veil) {
      player.invulnerableUntil = now + PLAYER.invulnerableMs;
      player.knockback.set(dirX * ENEMY.knockback * 1.6, dirY * ENEMY.knockback * 1.6 * VERTICAL_SPEED_RATIO);
      this.impacts.screenFlash(0xff3b2f, 0.18, 200);
      this.hitStop('hurt');
    } else {
      if (now >= this.slowedUntil) this.hud.showCallout('부식 웅덩이에 발이 무거워졌다');
      this.slowedUntil = Math.max(this.slowedUntil, now + BOSS.pool.slowMs);
    }
    this.drawHud();
    if (died) this.onPlayerDeath();
  };

  /** 전용 검 막기 자세와 검날을 따라가는 얇은 반사광을 표시한다. */
  private drawShield(time: number): void {
    const shield = this.shield, player = this.player;
    if (!shield) return;
    const hero = player.sprite;
    if (hero instanceof HeroSprite) hero.setGuarding(this.blocking);
    shield.clear();
    shield.setVisible(this.blocking);
    if (!this.blocking || !(hero instanceof HeroSprite)) return;
    const { base, tip } = hero.getBlade();
    if (Math.hypot(tip.x - base.x, tip.y - base.y) < 1) return;
    const pulse = 0.75 + 0.25 * Math.sin(time / 90);
    shield.setDepth(player.y + (hero.guardWeaponBehind ? -0.1 : 1));
    const palm = hero.getGuardSupportPoint();
    const dx = tip.x - base.x, dy = tip.y - base.y, length = Math.hypot(dx, dy);
    const at = palm ? ((palm.x - base.x) * dx + (palm.y - base.y) * dy) / (length * length) : 0;
    const gap = 22 * Math.abs(hero.scaleY) / length;
    const segments = palm ? [[0, Math.max(0, at - gap)], [Math.min(1, at + gap), 1]] : [[0, 1]];
    for (const [width, alpha] of [[5, 0.12], [1, 0.65]]) {
      shield.lineStyle(width, 0xe6f2ff, alpha * pulse);
      for (const [from, to] of segments) {
        shield.lineBetween(base.x + dx * from, base.y + dy * from, base.x + dx * to, base.y + dy * to);
      }
    }
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
    this.focusCompanion(enemy);
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
    // 쓰러지는 모습을 보여 준 뒤 받은 피해를 정리한 창을 띄운다. 확인하면 마지막으로 쉰 곳에서 다시 시작한다.
    if (this.playerRespawnAt !== undefined && time >= this.playerRespawnAt) {
      this.playerRespawnAt = undefined;
      this.deathMessage?.destroy();
      this.deathMessage = undefined;
      if (!this.player.alive) this.openDeathPanel();
    }
    for (let i = this.enemyRespawns.length - 1; i >= 0; i--) {
      const pending = this.enemyRespawns[i];
      if (time < pending.at) continue;
      this.enemyRespawns.splice(i, 1);
      if (pending.enemy.state === 'dead') this.respawnEnemy(pending.enemy);
    }
  }

  /** 보스: 경고가 끝나면 나타나게 하고, 체력 막대를 맞춘다. */
  private updateBoss(time: number, dt: number): void {
    this.drawArena(time);
    if (this.bossWarningEnd !== undefined) {
      this.bossHud?.updateWarning(time);
      if (!this.arena || this.arenaFadeAt !== undefined) this.openArena();
      this.pushIntoArena(dt);
      if (time >= this.bossWarningEnd) this.spawnBoss(time);
    }
    const boss = this.boss;
    if (boss) this.bossHud?.setHp(boss.character.hp, boss.character.maxHp, boss.phase);
  }

  private spawnBoss(time: number): void {
    const spawns = this.pendingBoss ?? [];
    this.bossWarningEnd = undefined;
    this.pendingBoss = undefined;
    this.bossHud?.hideWarning();
    this.closeArena();
    for (const spawn of spawns) {
      // 보스는 결계 안에서 주인공의 반대편에 내려앉는다.
      const point = spawn.boss && this.arena ? { ...spawn, ...bossLanding(this.arena, this.player, this.arenaOpen) } : spawn;
      const enemy = new Enemy(this, point.key, point.x, point.y, point.level, !!point.boss);
      this.enemies.push(enemy);
      this.raidEnemies.add(enemy);
      if (!point.boss) continue;
      this.boss = enemy;
      const c = enemy.character;
      this.bossHud?.showBar(enemy.stats.name, enemy.level, c.hp, c.maxHp);
      // 검은 먼지와 충격파 속에서 나타난다.
      this.impacts.impact(c.x, c.y - 80, 0, -1, 'finisher', time, c.y);
      this.impacts.dust(c.x, c.y, 12, time, 90);
      this.impacts.screenFlash(0x2a0010, 0.3, 260);
      this.cameras.main.shake(380, 0.009);
      this.hud.showCallout(`${enemy.stats.name}가 길을 막아선다!`);
    }
  }

  /** 체력이 절반 아래: 보스와 주인공이 함께 멈추고, 보스가 포효한 뒤 물러나 2페이즈를 시작한다. */
  private startBossRoar(enemy: Enemy): void {
    const now = this.now;
    enemy.startRoar(now);
    this.bossRoarUntil = now + BOSS.roarMs;
    this.player.invulnerableUntil = Math.max(this.player.invulnerableUntil, this.bossRoarUntil);
    this.player.knockback.set(0, 0);
    this.attackBufferedUntil = undefined;
    this.attackTrace = undefined;
    const c = enemy.character;
    this.cameras.main.shake(BOSS.roarMs * 0.85, 0.011);
    this.impacts.screenFlash(0x8c1010, 0.22, 420);
    this.impacts.impact(c.x, c.y - 90, 0, -1, 'finisher', now, c.y);
    this.impacts.dust(c.x, c.y, 14, now, 120);
    this.hud.showCallout(`${enemy.stats.name}가 포효한다!`);
  }

  private onBossDefeated(enemy: Enemy): void {
    this.boss = undefined;
    this.bossHud?.hideBar();
    this.bossRoarUntil = 0;
    this.liftArena();
    this.impacts.screenFlash(0xffffff, 0.2, 300);
    this.cameras.main.shake(420, 0.01);
    this.hud.showCallout(`${enemy.stats.name}를 쓰러뜨렸다!`);
  }

  // ---------------------------------------------------------------- 2장

  /** 광장 남문 안쪽에 페른의 수레를 세우고, 바퀴와 짐칸 자리는 지나가지 못하게 막는다(story/chapterTwo.ts). */
  private placeFernCart(): void {
    if (!fernCartVisible(this.quests, this.mapId)) return;
    const key = `fern-cart-${fernCartState(this.quests)}`;
    if (this.textures.exists(key)) {
      const image = this.add.image(FERN_CART.x, FERN_CART.y, key).setOrigin(0.5, 1).setDepth(FERN_CART.y);
      image.setScale(FERN_CART.width / image.width);
    }
    this.walkArea.obstacles.push({ ...FERN_CART_FOOTPRINT });
  }

  // ---------------------------------------------------------------- 기술

  /** 저장된 배운 기술과 기술 칸을 읽는다. 버튼을 만들기 전에 부른다. */
  private loadSkills(): void {
    let state: SkillState;
    try { state = parseSkills(this.storage?.getItem(SKILL_SAVE_KEY) ?? null, SKILL_SLOT_COUNT); } catch { state = parseSkills(null, SKILL_SLOT_COUNT); }
    this.learnedSkills = state.learned;
    this.skillSlots = state.slots;
  }

  /** 기술을 배운다(퀘스트 보상). 비어 있는 첫 칸에 넣고 저장한다. */
  learnSkill(id: SkillId): void {
    const result = learnSkill({ learned: this.learnedSkills, slots: this.skillSlots }, id);
    if (!result.learned) return;
    this.learnedSkills = result.state.learned;
    this.skillSlots = result.state.slots;
    try { this.storage?.setItem(SKILL_SAVE_KEY, serializeSkills(result.state)); } catch { /* 저장소가 막히면 이번 실행 동안만 */ }
    this.refreshSkillButtons();
    this.progressEffects.showPopup(this.player.x, this.player.y - 220, `새 기술: ${SKILLS[id].name}`, '#ffe08a');
  }

  // ---------------------------------------------------------------- 동료

  /** 저장된 동료를 읽는다. 개발 빌드에서는 ?companion=joan으로 정할 수 있다(?companion=none은 해제). */
  private loadCompanion(): void {
    let id: CompanionId | undefined;
    try { id = parseCompanion(this.storage?.getItem(COMPANION_SAVE_KEY) ?? null); } catch { id = undefined; }
    if (import.meta.env.DEV) {
      const fromUrl = new URLSearchParams(location.search).get('companion');
      if (fromUrl === 'none') id = undefined;
      else if (isCompanionId(fromUrl)) id = fromUrl;
    }
    this.companionId = id;
  }

  /** 동료를 정하거나(이야기에서 부른다) 떠나보낸다. 저장되어 맵을 옮기거나 다시 켜도 이어진다. */
  setCompanion(id: CompanionId | undefined): void {
    this.companionId = id;
    try {
      if (id) this.storage?.setItem(COMPANION_SAVE_KEY, id);
      else this.storage?.removeItem(COMPANION_SAVE_KEY);
    } catch { /* 저장소가 막히면 이번 실행 동안만 */ }
    this.companion?.destroy();
    this.companion = undefined;
    this.companionDownAt = undefined;
    this.spawnCompanion();
  }

  /** 주인공 뒤(걸을 수 있으면)에 동료를 세운다. */
  private spawnCompanion(): void {
    if (!this.companionId || this.companion || !this.player) return;
    const at = this.companionSpot();
    const npc = new Npc(this, companionNpcDef(this.companionId, at));
    npc.setBattle(true);
    this.companion = npc;
  }

  /** 동료가 설 자리: 주인공 뒤, 막혀 있으면 주인공 옆, 그것도 막히면 주인공 자리 */
  private companionSpot(): { x: number; y: number } {
    const p = this.player;
    const facing = { x: p.facing || 1, y: 0.4 };
    for (const spot of [followSpot(p, facing), followSpot(p, { x: -facing.x, y: 0.4 }), { x: p.x, y: p.y + 40 }]) {
      if (this.walkArea.contains(spot.x, spot.y) && this.npcCanStand(spot.x, spot.y)) return spot;
    }
    return { x: p.x, y: p.y };
  }

  /** 적이 노리거나 칠 수 있는 동료 (쓰러져 있거나 숨어 있으면 없음) */
  private companionFighters(): Npc[] {
    const c = this.companion;
    return c && c.visible && c.canFight ? [c] : [];
  }

  /** 주인공이 패링·저스트 회피로 휘청이게 한 적을 동료가 먼저 노린다. */
  private focusCompanion(enemy: Enemy): void {
    if (this.companion) this.companionFocus = { enemy, until: this.now + COMPANION.focusMs };
  }

  /**
   * 동료: 연출과 보스전(결계) 동안에는 물러나 있고, 쓰러졌으면 recoverMs 뒤 다시 일어난다.
   * 주인공 가까이(leash)에 적이 있으면 수비대와 같은 전투(NpcFighter)로 싸우고, 없으면 주인공을 따라온다.
   */
  private updateCompanion(time: number, dt: number): void {
    const c = this.companion;
    if (!c) return;
    const away = !!this.opening || this.arena !== undefined;
    c.setVisible(!away);
    if (away) return;
    if (c.downed) {
      this.companionDownAt ??= time;
      if (time < this.companionDownAt + COMPANION.recoverMs) return;
      c.revive();
      this.companionDownAt = undefined;
    }
    const hero = this.player;
    const focus = this.companionFocus && time < this.companionFocus.until && this.companionFocus.enemy.character.alive ? this.companionFocus.enemy : undefined;
    if (!focus) this.companionFocus = undefined;
    const targets = this.enemies.map((e, id) => {
      const ok = canEngage({ x: e.character.x, y: e.character.y, alive: e.character.alive && e.state !== 'dead' && !e.untouchable, boss: e.boss }, hero);
      return { id, x: e.character.x, y: e.character.y, alive: ok && (!focus || e === focus), attacking: e.state === 'windup' };
    });
    const near = targets.some((t) => t.alive && Math.hypot(t.x - c.x, t.y - c.y) <= NPC_COMBAT.engageRadius);
    if (near || c.fighting) {
      c.updateCombat(time, dt, targets, this.walkArea, this.npcCanStand, (id) => {
        const enemy = this.enemies[id];
        if (enemy) this.allyStrike(c, id, companionDamage(this.stats.damageMin, this.stats.damageMax, enemy === focus), time);
      });
      return;
    }
    c.followHero(hero, dt, PLAYER_SPEED, this.walkArea, followPlan(c, hero), this.companionSpot());
  }

  // ---------------------------------------------------------------- 보스전 결계

  /** 결계 자리로 쓸 수 있는 바닥인지: 원래 걸을 수 있고, 출구가 아니고, 건물 그림·나무 뒤에 가려지지 않는 곳 */
  private readonly arenaOpen = (x: number, y: number): boolean => {
    const area = this.baseWalkArea ?? this.walkArea;
    if (!area.contains(x, y) || findExit(this.map, x, y)) return false;
    return !this.arenaOccluders().some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  };

  private occluderCache?: Array<{ left: number; top: number; right: number; bottom: number }>;

  /** 발이 이 안에 있으면 그림에 몸이 가려지는 사각형들 (건물 그림, 나무 갓). 그림의 아래 끝보다 위쪽만. */
  private arenaOccluders(): Array<{ left: number; top: number; right: number; bottom: number }> {
    if (this.occluderCache) return this.occluderCache;
    const rects: Array<{ left: number; top: number; right: number; bottom: number }> = [];
    for (const o of this.children.list) {
      if (!(o instanceof Phaser.GameObjects.Image)) continue;
      const key = o.texture.key;
      if (key !== 'village-buildings' && key !== 'village-props') continue;
      const w = o.displayWidth, h = o.displayHeight;
      // 꽃·덤불처럼 낮은 소품은 몸을 가리지 않는다.
      if (h < 140) continue;
      const inset = key === 'village-props' ? 0.28 : 0.08;
      rects.push({ left: o.x - w / 2 + w * inset, right: o.x + w / 2 - w * inset, top: o.y - h * 0.85, bottom: o.y - 8 });
    }
    return (this.occluderCache = rects);
  }

  /** "보스 등장" 경고와 함께: 결계 자리를 고르고 고리를 번지게 하며, 싸우던 병사들은 물러난다. */
  private openArena(): void {
    this.baseWalkArea = this.walkArea;
    this.arena = chooseArena(this.player, this.map.bounds, this.arenaOpen);
    this.arenaClosed = false;
    this.arenaFadeAt = undefined;
    this.arenaOpenedAt = this.now;
    this.arenaRing ??= this.add.graphics().setDepth(-40);
    const away = this.npcs.filter((npc) => npc.isFighter);
    for (const npc of away) this.awayNpcs.add(npc);
    const spots = new Set(away.map((npc) => npc.spot));
    this.interactables = this.interactables.filter((spot) => !spots.has(spot));
    if (away.length > 0) this.hud.showCallout('병사들이 주민들을 지키러 물러난다');
  }

  /** 경고 동안: 고리 밖에 있으면 안개가 주인공을 고리 안쪽으로 밀어 넣는다(조작은 막지 않는다). */
  private pushIntoArena(dt: number): void {
    const arena = this.arena;
    if (!arena || this.arenaClosed || !this.player.alive || insideArena(arena, this.player.x, this.player.y, ARENA.pushInner)) return;
    const to = pushTowardArena(arena, this.player.x, this.player.y, ARENA.pushSpeed * dt);
    const next = this.walkArea.move(this.player.x, this.player.y, to.x - this.player.x, to.y - this.player.y, this.scratch);
    this.player.placeAt(next.x, next.y);
  }

  /** 보스가 나타나는 순간: 고리가 닫혀 그 밖으로 나갈 수 없다. 아직 밖에 있으면 고리 안쪽 첫 자리로 옮긴다. */
  private closeArena(): void {
    const arena = this.arena;
    if (!arena || !this.baseWalkArea) return;
    const base = this.baseWalkArea;
    if (!insideArena(arena, this.player.x, this.player.y) || !base.contains(this.player.x, this.player.y)) {
      const at = entryPoint(arena, this.player.x, this.player.y, (x, y) => base.contains(x, y) && !findExit(this.map, x, y));
      this.player.placeAt(at.x, at.y);
      this.impacts.dust(at.x, at.y, 8, this.now, 70);
    }
    this.walkArea = base.fenced((x, y) => insideArena(arena, x, y) && !findExit(this.map, x, y));
    this.arenaClosed = true;
  }

  /** 보스를 쓰러뜨리면 안개가 걷히고, 걸을 수 있는 영역과 물러났던 병사들이 돌아온다. */
  private liftArena(): void {
    if (!this.arena) return;
    if (this.baseWalkArea) this.walkArea = this.baseWalkArea;
    this.baseWalkArea = undefined;
    this.arenaClosed = false;
    this.arenaFadeAt = this.now;
    const back = [...this.awayNpcs];
    this.awayNpcs.clear();
    for (const npc of back) {
      npc.setVisible(true).setAlpha(0);
      if (!this.interactables.includes(npc.spot)) this.interactables.push(npc.spot);
    }
    if (back.length > 0) this.hud.showCallout('안개가 걷히고 병사들이 돌아온다');
  }

  /** 바닥의 부식 안개 고리. 경고 동안 번지고, 닫히면 짙어지며, 걷힐 때 흐려진다. 물러나고 돌아오는 병사도 흐려졌다 나타난다. */
  private drawArena(time: number): void {
    const arena = this.arena, g = this.arenaRing;
    if (!arena || !g) return;
    const spread = Math.min(1, (time - this.arenaOpenedAt) / (BOSS.warningMs * 0.7));
    const fade = this.arenaFadeAt === undefined ? 1 : 1 - (time - this.arenaFadeAt) / ARENA.fadeOutMs;
    for (const npc of this.npcs) {
      if (this.awayNpcs.has(npc)) {
        const alpha = Math.max(0, 1 - (time - this.arenaOpenedAt) / 700);
        npc.setAlpha(alpha).setVisible(alpha > 0);
      } else if (npc.alpha < 1) npc.setAlpha(Math.min(1, npc.alpha + 0.04));
    }
    g.clear();
    if (fade <= 0) {
      this.arena = undefined;
      return;
    }
    const strength = (this.arenaClosed ? 1 : 0.55 + 0.25 * spread) * fade;
    const scale = 0.35 + 0.65 * (1 - (1 - spread) ** 3);
    const rx = arena.rx * scale, ry = arena.ry * scale;
    // 고리 바깥쪽으로 짙은 안개 띠를 겹겹이(바깥일수록 옅게), 테두리는 넘실거리는 안개 덩어리와 밝은 선으로.
    for (let band = 0; band < 6; band++) {
      const grow = 30 + band * 34;
      g.lineStyle(40, band % 2 ? 0x3d2a4a : 0x2f4a22, (0.34 - band * 0.05) * strength)
        .strokeEllipse(arena.x, arena.y, rx * 2 + grow, ry * 2 + grow * 0.56);
    }
    const count = 64;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + time / 9000;
      const wobble = Math.sin(time / 420 + i * 1.7);
      const x = arena.x + Math.cos(a) * (rx + 14 + 8 * wobble);
      const y = arena.y + Math.sin(a) * (ry + 8 + 5 * wobble);
      g.fillStyle(i % 3 === 0 ? 0x6b4a82 : 0x5f8f36, (0.38 + 0.14 * wobble) * strength).fillCircle(x, y, 26 + 9 * wobble);
    }
    g.lineStyle(6, 0xb6f07a, 0.8 * strength).strokeEllipse(arena.x, arena.y, rx * 2, ry * 2);
    g.lineStyle(2, 0xeaffd0, 0.5 * strength * (0.6 + 0.4 * Math.sin(time / 200))).strokeEllipse(arena.x, arena.y, rx * 2 - 16, ry * 2 - 9);
  }

  /**
   * 수련 연습이 막 시작됐고 아직 안내를 본 적이 없으면 시스템 안내 창을 띄운다(한 번만, 기기에 저장).
   * 물약 수련은 다친 상태에서 연습하도록 체력이 가득이면 조금 깎아 두고(에일라가 상처를 봐 주는 장면),
   * 공명 수련은 바로 써 볼 수 있게 구슬을 가득 채운다.
   */
  private showLessonIfNew(): boolean {
    if (!this.guideCard || this.opening || this.traveling || !this.player?.alive || this.menuOpen()) return false;
    const lesson = lessonToShow(this.quests, this.seenLessons);
    if (!lesson) return false;
    this.seenLessons.add(lesson.id);
    try { this.storage?.setItem(GUIDE_SAVE_KEY, serializeSeenLessons(this.seenLessons)); } catch { /* 저장소가 막히면 다음에 다시 본다 */ }
    if (lesson.id === 'potion' && this.player.hp >= this.player.maxHp) {
      this.player.hp = Math.max(1, Math.round(this.player.maxHp * 0.7));
      this.drawHud();
    }
    if (lesson.id === 'resonance') this.setResonanceCharge(Math.max(this.resonanceCharge, maxCharge(RESONANCE)));
    this.clearAttackInput();
    this.joystick.vector.set(0, 0);
    this.guideCard.open(lesson, () => this.onResume());
    return true;
  }

  /** 연습 중인 수련의 버튼 둘레에 고리를 반짝인다. 메뉴·대화·연출 중에는 숨긴다. */
  private updateGuideHighlight(): void {
    const lesson = this.player && !this.opening && !this.traveling && !this.menuOpen() ? activeLesson(this.quests) : undefined;
    const buttons: Record<GuideButton, ActionButton | undefined> = {
      attack: this.attackButton, dodge: this.dodgeButton, block: this.blockButton, item: this.potionButton, resonance: this.resonanceButton,
    };
    const button = lesson ? buttons[lesson.button] : undefined;
    this.guideCard?.highlight(button?.visible ? { ...button.center, radius: button.size } : undefined, this.time.now);
  }

  /** 다시 시작할 곳: 마지막으로 쉰 곳(여관·시온의 집), 쉰 적이 없으면 시온의 집 앞 */
  private restartPoint(): { name: string; map: MapId; at: Point } {
    const rested = this.loadRestPoint();
    return rested ? { name: `마지막으로 쉰 곳(${rested.name})`, map: rested.map, at: { ...rested.at } }
      : { name: '처음 시작한 곳(시온의 집 앞)', map: START_MAP, at: { ...MAPS[START_MAP].spawn } };
  }

  private openDeathPanel(): void {
    this.clearAttackInput();
    this.attackButton.setVisible(false);
    this.talkMarker.setVisible(false);
    const point = this.restartPoint();
    this.deathPanel?.open(deathReport(this.damageLog), point.name, () => {
      this.travel({ to: point.map, arrive: point.at, zone: { left: 0, top: 0, right: 0, bottom: 0 }, label: '', labelAt: point.at }, true);
    });
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
