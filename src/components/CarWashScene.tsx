import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { saveToDrive, loadFromDrive } from "@/lib/drive.functions";
import { avatarSrc, usePlayer } from "@/lib/player";
import { RentalManager } from "@/components/RentalManager";
import { GameDashboard } from "@/components/GameDashboard";
import { ClientsMenu } from "@/components/ClientsMenu";
import { InteractionHud } from "@/components/InteractionHud";
import { CarWashStatsMenu } from "@/components/CarWashStatsMenu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


const SAVE_VERSION = 7;


import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import modelsAsset from "@/assets/car-wash-models.json.asset.json";

import tunnelAsset from "@/assets/tunnel.glb.asset.json";
import kenneyPackAsset from "@/assets/kenney-pack.glb.asset.json";
import citizenMaleA from "@/assets/character-male-a.glb.asset.json";
import citizenMaleC from "@/assets/character-male-c.glb.asset.json";
import citizenFemaleA from "@/assets/character-female-a.glb.asset.json";
import citizenFemaleD from "@/assets/character-female-d.glb.asset.json";
import {
  CityPlan,
  type SerializedPlan,
  type SerializedHouses,
  type SerializedDecor,
} from "@/game/cityPlan";
import {
  
  decorDef,
  decorOf,
  DEFAULT_WASH_STYLE,
  sanitizeWashStyle,
  WASH_COLORS,
  type DecorCategory,
  type DecorKind,
  type WashStyle,
} from "@/game/decor";
import {
  TILE,
  DIR_VEC,
  opposite,
  axisOf,
  rightOf,
  parseKey,
  worldToCell,
  type Dir,
} from "@/game/grid";
import { TOOL_LABEL, type BuildTool, type RoadHint } from "@/game/catalog";
import {
  UPGRADES,
  DEFAULT_UPGRADES,
  MAX_LEVEL,
  queueCapacity,
  computeReward,
  upgradeCost,
  upgradePreview,
  sanitizeUpgrades,
  type UpgradeKey,
  type UpgradeLevels,
} from "@/game/upgrades";
import {
  MAX_HISTORY,
  EVENT_META,
  formatWashDate,
  makeEvent,
  sanitizeHistory,
  type EventKind,
  type GameEvent,
} from "@/game/history";
import { HOUSE_LEVELS, MAX_HOUSE_LEVEL, houseDef, totalCapacity } from "@/game/houses";
import { readLocalCity, saveLocalCity } from "@/game/save";
import { createPedestrianSystem, type PedestrianSystem } from "@/game/pedestrians";
import { createPlayerController, type PlayerController } from "@/game/playerController";
import { findNearbyInteraction, type NearbyInteraction } from "@/game/interactions";
import { nextMilestone, sanitizeCityProgress, type CityProgress } from "@/game/progression";
import { installAutoCityGrowth } from "@/game/autoCityGrowth";
import {
  DEFAULT_ROLLER_PART_GRADE,
  PART_GRADE_META,
  STREET_VENDORS,
  rollerWearPerWash,
  rollerQualityFactor,
  rollerQualityLoss,
  sanitizeRollerPartGrade,
  sanitizeRollerCondition,
  type RollerPartGrade,
} from "@/game/spareParts";
import {
  DEFAULT_CLIENT_BEHAVIOR,
  carsPerHour,
  effectiveArrivalInterval,
  effectiveBeltFactor,
  effectiveWashDuration,
  neighborhoodDemand,
  sanitizeClientBehavior,
  travelerDemand,
  type ClientBehavior,
  type NeighborhoodStats,
} from "@/game/clientBehavior";
import { EMPTY_WASH_METRICS, formatPlayTime, recordFinance, sanitizeFinancePeriods, sanitizeWashMetrics, washAverages, type FinancePeriod, type WashMetrics } from "@/game/metrics";
import { eventSatisfactionBonus, eventTrafficFactor, nextEventDelay, randomUrbanEvent, sanitizeUrbanEvent, URBAN_EVENT_META, type UrbanEvent } from "@/game/urbanEvents";
import { CameraControlsHud } from "@/components/CameraControlsHud";
import {
  districtAt,
  districtDemandFactor,
  districtUnlocks,
  nextDistrictLevel,
  sanitizeDistrictLevel,
} from "@/game/districtLevels";


/* Catégories de la barre de construction : un seul onglet visible à la fois
   pour garder la vue 3D dégagée. */
type BuildCategory = "routes" | "espaces" | "batiments" | "mobilier" | "station" | "outils";

const BUILD_CATEGORIES: Array<{ id: BuildCategory; icon: string; label: string; tools: BuildTool[] }> = [
  { id: "routes", icon: "🛣️", label: "Routes", tools: ["straight", "bend", "intersection", "crossroad"] },
  { id: "batiments", icon: "🏠", label: "Maisons", tools: ["house"] },
  { id: "espaces", icon: "🌳", label: "Espaces", tools: ["park", "parking"] },
  { id: "mobilier", icon: "💡", label: "Mobilier", tools: ["light", "lamp"] },
  { id: "station", icon: "🫧", label: "Station", tools: ["wash"] },
  { id: "outils", icon: "🧹", label: "Outils", tools: ["bulldoze", "erase"] },
];


/* Modèles issus des kits Kenney (car-kit, city-kit-roads, building-kit),
   regroupés dans un seul GLB optimisé. */
const KIT_CARS = [
  "sedan",
  "sedan-sports",
  "suv",
  "suv-luxury",
  "taxi",
  "van",
  "delivery",
  "hatchback-sports",
  "police",
  "truck",
  "ambulance",
] as const;




const MESSAGES = [
  "Préparation du savon...",
  "Déroulement du tapis...",
  "Réglage des brosses...",
  "Ouverture du portail...",
];

const MODEL_KEYS = [
  "sedan",
  "taxi",
  "roadStraight",
  "roadEnd",
  "tunnel",
  "hFloor",
  "hWallWindow",
  "hRoof",
] as const;

const ROAD_Y = 0;
const PATH_START = -13;
const PATH_END = 13;
const WASH_ZONE: [number, number] = [-1.5, 5.5];
/* Le car wash a sa propre parcelle en périphérie sud de la ville,
   reliée à la grille par une voie d'accès dédiée. */
const WASH_SITE_Z = -42;
const WASH_ACCESS_X = 6;
const DIRT_COLOR = new THREE.Color(0x8a7355);

function b64ToArrayBuffer(b64: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export default function CarWashScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const gameTimeRef = useRef<HTMLSpanElement>(null);
  const gameTimeBuildRef = useRef<HTMLSpanElement>(null);
  const { player } = usePlayer();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(MESSAGES[0]!);
  const cinemaRef = useRef<() => void>(() => {});
  const [cinema, setCinema] = useState(false);
  const [machines, setMachines] = useState({
    belt: true,
    rollers: true,
    brushes: true,
    traffic: true,
  });
  const machinesRef = useRef(machines);
  const [rollerCondition, setRollerCondition] = useState(100);
  const rollerConditionRef = useRef(100);
  const [rollerPartGrade, setRollerPartGrade] = useState<RollerPartGrade>(DEFAULT_ROLLER_PART_GRADE);
  const rollerPartGradeRef = useRef<RollerPartGrade>(DEFAULT_ROLLER_PART_GRADE);

  /* ----- Économie : chaque lavage terminé rapporte de l'argent.
     Les routes restent gratuites (aucun coût de construction). ----- */
  const [economy, setEconomy] = useState({ money: 150, washes: 0 });
  const economyRef = useRef(economy);
  const [gain, setGain] = useState<{ id: number; amount: number } | null>(null);
  const [washMetrics, setWashMetrics] = useState<WashMetrics>(EMPTY_WASH_METRICS);
  const washMetricsRef = useRef<WashMetrics>(EMPTY_WASH_METRICS);
  const [financePeriods, setFinancePeriods] = useState<FinancePeriod[]>([]);
  const financePeriodsRef = useRef<FinancePeriod[]>([]);
  const [playSeconds, setPlaySeconds] = useState(0);
  const playSecondsRef = useRef(0);
  const [statsOpen, setStatsOpen] = useState(false);
  const [historyView, setHistoryView] = useState<"journal" | "profit">("journal");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeUrbanEvent, setActiveUrbanEvent] = useState<UrbanEvent | null>(null);
  const activeUrbanEventRef = useRef<UrbanEvent | null>(null);
  const nextUrbanEventAtRef = useRef(Date.now() + 45_000);
  const freeBuildingRef = useRef<() => string | null>(() => null);
  /* Niveau du quartier : déblocages de construction et bonus de fréquentation. */
  const [districtLevel, setDistrictLevel] = useState(1);
  const districtLevelRef = useRef(1);
  /* Exploration libre : la caméra peut parcourir tout le quartier. */
  const [freeCamera, setFreeCamera] = useState(false);
  const freeCameraRef = useRef(false);
  const freeCameraPanRef = useRef<(dt: number) => void>(() => {});
  const cameraIoRef = useRef<{
    setFree: (on: boolean) => void;
    zoom: (direction: 1 | -1) => void;
    reset: () => void;
    focusWash: () => void;
    save: () => number[] | null;
    load: (data: unknown) => void;
  }>({
    setFree: () => {},
    zoom: () => {},
    reset: () => {},
    focusWash: () => {},
    save: () => null,
    load: () => {},
  });
  /* Journal de la partie : lavages, achats, constructions (horodatés). */
  const [history, setHistory] = useState<GameEvent[]>([]);
  const historyRef = useRef(history);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<EventKind | "all">("all");
  /** Écrit immédiatement l'état courant après une action économique importante. */
  const persistNowRef = useRef<() => void>(() => {});
  /** Ajoute une entrée au journal (la plus récente en tête). */
  const logRef = useRef<(e: GameEvent) => void>(() => {});
  logRef.current = (entry: GameEvent) => {
    const next = [entry, ...historyRef.current].slice(0, MAX_HISTORY);
    historyRef.current = next;
    setHistory(next);
    if (entry.amount) {
      const periods = recordFinance(financePeriodsRef.current, playSecondsRef.current, entry.amount);
      financePeriodsRef.current = periods;
      setFinancePeriods(periods);
    }
    persistNowRef.current();
  };
  const registerWashRef = useRef<(amount: number, premium: boolean, duration: number) => void>(() => {});
  registerWashRef.current = (amount: number, premium: boolean, duration: number) => {
    const satisfaction = Math.max(35, Math.min(100, Math.round(58 + rollerQualityFactor(rollerConditionRef.current) * 28 + (upgradesRef.current.quality - 1) * 3 + (upgradesRef.current.decor - 1) * 2 + eventSatisfactionBonus(activeUrbanEventRef.current))));
    const metrics = { count: washMetricsRef.current.count + 1, revenue: washMetricsRef.current.revenue + amount, totalDuration: washMetricsRef.current.totalDuration + duration, totalSatisfaction: washMetricsRef.current.totalSatisfaction + satisfaction, premiumCount: washMetricsRef.current.premiumCount + (premium ? 1 : 0) };
    washMetricsRef.current = metrics;
    setWashMetrics(metrics);
    const nextCondition = sanitizeRollerCondition(rollerConditionRef.current - rollerWearPerWash(rollerPartGradeRef.current));
    rollerConditionRef.current = nextCondition;
    setRollerCondition(nextCondition);
    setEconomy((prev) => {
      const next = { money: prev.money + amount, washes: prev.washes + 1 };
      economyRef.current = next;
      logRef.current(
        makeEvent(
          "wash",
          `Lavage #${next.washes}${premium ? " ✨ premium" : ""}`,
          amount,
          next.money,
        ),
      );
      return next;
    });
    setGain({ id: Date.now() + Math.random(), amount });
  };

  useEffect(() => {
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const next = playSecondsRef.current + (now - previous) / 1000;
      previous = now;
      playSecondsRef.current = next;
      setPlaySeconds(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const current = activeUrbanEventRef.current;
      if (current && now >= current.endsAt) {
        logRef.current(makeEvent("urban", `${current.title} · terminé`));
        activeUrbanEventRef.current = null;
        setActiveUrbanEvent(null);
        nextUrbanEventAtRef.current = now + nextEventDelay();
        return;
      }
      if (!current && now >= nextUrbanEventAtRef.current) {
        const event = randomUrbanEvent(now);
        if (event.kind === "building") {
          const building = freeBuildingRef.current();
          event.description = building ? `${building} vient d’être construit gratuitement.` : "La ville réserve le prochain terrain disponible.";
        }
        activeUrbanEventRef.current = event;
        setActiveUrbanEvent(event);
        logRef.current(makeEvent("urban", `${event.title} · ${event.description}`));
        toast.success(`${URBAN_EVENT_META[event.kind].icon} ${event.title}`, { description: event.description });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!gain) return;
    const id = window.setTimeout(() => setGain(null), 1600);
    return () => window.clearTimeout(id);
  }, [gain]);

  /* ----- Boutique d'améliorations ----- */
  const [upgrades, setUpgrades] = useState<UpgradeLevels>(DEFAULT_UPGRADES);
  const upgradesRef = useRef(upgrades);
  const [shopOpen, setShopOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);
  const [clientBehavior, setClientBehavior] = useState<ClientBehavior>(DEFAULT_CLIENT_BEHAVIOR);
  const clientBehaviorRef = useRef(clientBehavior);
  const [upgradeInfoOpen, setUpgradeInfoOpen] = useState<UpgradeKey | null>(null);
  const [pendingUpgrade, setPendingUpgrade] = useState<UpgradeKey | null>(null);
  const [purchasingUpgrade, setPurchasingUpgrade] = useState<UpgradeKey | null>(null);
  const purchaseLockRef = useRef(false);

  const updateClientBehavior = (next: ClientBehavior) => {
    const safe = sanitizeClientBehavior(next);
    clientBehaviorRef.current = safe;
    setClientBehavior(safe);
    window.setTimeout(() => persistNowRef.current(), 0);
  };

  const requestUpgrade = (key: UpgradeKey) => {
    if (purchaseLockRef.current) return;
    const level = upgradesRef.current[key];
    if (level >= MAX_LEVEL) return;
    const cost = upgradeCost(key, level);
    if (economyRef.current.money < cost) {
      toast.error(`Il manque ${(cost - economyRef.current.money).toLocaleString("fr-FR")} €`);
      return;
    }
    setUpgradeInfoOpen(null);
    setPendingUpgrade(key);
  };

  const confirmUpgrade = async () => {
    const key = pendingUpgrade;
    if (!key || purchaseLockRef.current) return;
    purchaseLockRef.current = true;
    setPurchasingUpgrade(key);

    // Laisse le verrou visuel apparaître avant d'appliquer l'achat.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    const level = upgradesRef.current[key];
    if (level >= MAX_LEVEL) {
      toast.error("Cette amélioration est déjà au niveau maximal.");
      setPendingUpgrade(null);
      setPurchasingUpgrade(null);
      purchaseLockRef.current = false;
      return;
    }
    const def = UPGRADES.find((u) => u.key === key);
    if (!def) {
      setPendingUpgrade(null);
      setPurchasingUpgrade(null);
      purchaseLockRef.current = false;
      return;
    }
    const cost = upgradeCost(key, level);
    if (economyRef.current.money < cost) {
      toast.error(`Il manque ${(cost - economyRef.current.money).toLocaleString("fr-FR")} €`);
      setPendingUpgrade(null);
      setPurchasingUpgrade(null);
      purchaseLockRef.current = false;
      return;
    }
    const nextEco = { ...economyRef.current, money: economyRef.current.money - cost };
    economyRef.current = nextEco;
    setEconomy(nextEco);
    const nextUp = { ...upgradesRef.current, [key]: level + 1 };
    upgradesRef.current = nextUp;
    setUpgrades(nextUp);
    logRef.current(
      makeEvent("upgrade", `${def.label} niveau ${level + 1}`, -cost, nextEco.money),
    );
    toast.success(`${def.icon} ${def.label} niveau ${level + 1}`, {
      description: def.effect(level + 1),
    });
    persistNowRef.current();
    setPendingUpgrade(null);
    setPurchasingUpgrade(null);
    purchaseLockRef.current = false;
  };



  const toggleMachine = (key: keyof typeof machines) => {
    setMachines((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      machinesRef.current = next;
      return next;
    });
  };

  /* ----- Quartiers résidentiels : maisons posées par le joueur ----- */
  const [houseLevel, setHouseLevel] = useState(1);
  const houseLevelRef = useRef(1);
  const [city, setCity] = useState({ houses: 0, capacity: 0 });
  const [residents, setResidents] = useState(0);
  const residentsRef = useRef(0);
  const cityRef = useRef(city);
  const [planStats, setPlanStats] = useState({ roads: 0, decor: 0, parking: 0 });
  const neighborhoodRef = useRef<NeighborhoodStats>({ houses: 0, residents: 0, roads: 0, parking: 0 });
  const [progress, setProgress] = useState<CityProgress>({ unlocked: [] });
  const progressRef = useRef(progress);
  const playerControllerRef = useRef<PlayerController | null>(null);
  const pedestrianRef = useRef<PedestrianSystem | null>(null);
  const [nearbyInteraction, setNearbyInteraction] = useState<NearbyInteraction | null>(null);
  const nearbyInteractionRef = useRef<NearbyInteraction | null>(null);
  const [activeDialogue, setActiveDialogue] = useState<NearbyInteraction | null>(null);
  const activeDialogueRef = useRef<NearbyInteraction | null>(null);
  const cityStatsRef = useRef<(levels: number[]) => void>(() => {});
  cityStatsRef.current = (levels: number[]) => {
    const next = { houses: levels.length, capacity: totalCapacity(levels) };
    cityRef.current = next;
    neighborhoodRef.current.houses = next.houses;
    setCity(next);
  };
  /* Dépense d'argent depuis la scène 3D (pose / amélioration de maison). */
  const spendRef = useRef<(amount: number, kind?: EventKind, label?: string) => boolean>(
    () => false,
  );
  spendRef.current = (amount: number, kind?: EventKind, label?: string) => {
    if (economyRef.current.money < amount) {
      toast.error(`Il manque ${(amount - economyRef.current.money).toLocaleString("fr-FR")} €`);
      return false;
    }
    const next = { ...economyRef.current, money: economyRef.current.money - amount };
    economyRef.current = next;
    setEconomy(next);
    if (label) logRef.current(makeEvent(kind ?? "build", label, -amount, next.money));
    return true;
  };

  /** Revenus des logements : le locataire paie le loyer, puis les impôts sont déduits. */
  const receiveRentalIncome = (gross: number, tax: number, label: string) => {
    const net = gross - tax;
    setEconomy((prev) => {
      const next = { ...prev, money: prev.money + net };
      economyRef.current = next;
      logRef.current(makeEvent("house", `Loyer · ${label}`, gross, prev.money + gross));
      logRef.current(makeEvent("house", `Impôts · ${label}`, -tax, next.money));
      return next;
    });
    setGain({ id: Date.now() + Math.random(), amount: net });
  };

  const spendRentalNeed = (amount: number, label: string) =>
    spendRef.current(amount, "house", `Besoin locataire · ${label}`);

  /* Les habitants arrivent progressivement jusqu'à la capacité des maisons. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setResidents((prev) => {
        const cap = cityRef.current.capacity;
        const next = prev < cap ? prev + 1 : prev > cap ? cap : prev;
        residentsRef.current = next;
        if (next > prev && (next === 1 || next % 10 === 0)) {
          toast.success(`👥 ${next} habitant${next > 1 ? "s" : ""} à TikowikoCity`);
        }
        if (next > prev && (next === 1 || next % 5 === 0)) {
          logRef.current(
            makeEvent("info", `Nouvel habitant · TikowikoCity compte ${next} résident${next > 1 ? "s" : ""}`),
          );
        }
        return next;
      });
    }, 2200);
    return () => window.clearInterval(timer);
  }, []);

  const chooseHouseLevel = (l: number) => {
    houseLevelRef.current = l;
    setHouseLevel(l);
  };

  /* ----- Mode construction (pose de routes / mobilier par le joueur) ----- */
  const [buildMode, setBuildMode] = useState(false);
  const [walking, setWalking] = useState(false);
  const walkingRef = useRef(false);
  const [buildCameraMode, setBuildCameraMode] = useState(false);
  const [tool, setTool] = useState<BuildTool>("straight");
  const [rot, setRot] = useState(0);
  const [buildCat, setBuildCat] = useState<BuildCategory>("routes");
  /** panneau machines replié par défaut sur petit écran */
  const [controlOpen, setControlOpen] = useState(false);
  const buildRef = useRef(false);
  const buildCameraRef = useRef(false);
  const toolRef = useRef<BuildTool>("straight");
  const rotRef = useRef(0);
  const buildApplyRef = useRef<(on: boolean) => void>(() => {});
  const buildCameraApplyRef = useRef<(on: boolean) => void>(() => {});
  /* Décor sélectionné dans chaque catégorie + personnalisation du car wash */
  const [decorKind, setDecorKind] = useState<Record<DecorCategory, DecorKind>>({
    park: "park",
    parking: "parking",
  });
  const decorKindRef = useRef<DecorKind>("park");
  const [washStyle, setWashStyle] = useState<WashStyle>(DEFAULT_WASH_STYLE);
  const washStyleRef = useRef<WashStyle>(DEFAULT_WASH_STYLE);
  const washApplyRef = useRef<(s: WashStyle) => void>(() => {});
  const planIoRef = useRef<{
    save: () => SerializedPlan;
    load: (data: SerializedPlan) => void;
    saveHouses: () => SerializedHouses;
    loadHouses: (data: SerializedHouses) => void;
    saveDecor: () => SerializedDecor;
    loadDecor: (data: SerializedDecor) => void;
  }>({
    save: () => [],
    load: () => {},
    saveHouses: () => [],
    loadHouses: () => {},
    saveDecor: () => [],
    loadDecor: () => {},
  });

  const chooseDecor = (kind: DecorKind) => {
    const def = decorDef(kind);
    decorKindRef.current = kind;
    setDecorKind((prev) => ({ ...prev, [def.category]: kind }));
  };
  const applyWashStyle = (patch: Partial<WashStyle>) => {
    const next = { ...washStyleRef.current, ...patch };
    washStyleRef.current = next;
    setWashStyle(next);
    washApplyRef.current(next);
  };

  const chooseTool = (t: BuildTool) => {
    toolRef.current = t;
    setTool(t);
    if (t === "park" || t === "parking") decorKindRef.current = decorKind[t];
  };
  /** Onglet de construction : sélectionne aussi le premier outil de la catégorie. */
  const chooseCategory = (cat: BuildCategory) => {
    setBuildCat(cat);
    const first = BUILD_CATEGORIES.find((c) => c.id === cat)?.tools[0];
    if (first) chooseTool(first);
  };
  const toggleBuildCamera = () => {
    const next = !buildCameraRef.current;
    buildCameraRef.current = next;
    setBuildCameraMode(next);
    buildCameraApplyRef.current(next);
  };
  const toggleBuild = () => {
    setBuildMode((prev) => {
      const next = !prev;
      if (next && walkingRef.current) {
        walkingRef.current = false;
        setWalking(false);
        playerControllerRef.current?.setEnabled(false);
      }
      buildRef.current = next;
      if (!next) {
        buildCameraRef.current = false;
        setBuildCameraMode(false);
      }
      buildApplyRef.current(next);
      return next;
    });
  };
  const toggleWalking = () => {
    if (buildRef.current) return;
    const next = !walkingRef.current;
    walkingRef.current = next;
    setWalking(next);
    playerControllerRef.current?.setEnabled(next);
    if (next && freeCameraRef.current) {
      freeCameraRef.current = false;
      setFreeCamera(false);
      cameraIoRef.current.setFree(false);
    }
    if (!next) {
      nearbyInteractionRef.current = null;
      setNearbyInteraction(null);
      activeDialogueRef.current = null;
      setActiveDialogue(null);
      playerControllerRef.current?.setPaused(false);
    }
    buildCameraApplyRef.current(false);
  };

  /** Exploration libre : on quitte marche/construction pour survoler la ville. */
  const toggleFreeCamera = () => {
    const next = !freeCameraRef.current;
    if (next) {
      if (walkingRef.current) toggleWalking();
      if (buildRef.current) toggleBuild();
      if (cinemaStateRef.current) cinemaRef.current();
    }
    freeCameraRef.current = next;
    setFreeCamera(next);
    cameraIoRef.current.setFree(next);
    if (next) toast.info("🔭 Exploration libre activée");
  };

  /* Instantané du quartier utilisé par la jauge et les paliers. */
  const districtSnapshot = {
    roads: planStats.roads,
    houses: city.houses,
    residents,
    washes: economy.washes,
  };

  /** Ouvre le palier suivant du quartier : coût payé, bonus permanent. */
  const upgradeDistrict = () => {
    const progressInfo = nextDistrictLevel(districtLevelRef.current, districtSnapshot, economyRef.current.money);
    const target = progressInfo?.next;
    if (!progressInfo || !target) return;
    if (!progressInfo.ready) {
      toast.error("Objectifs du palier non atteints.");
      return;
    }
    if (target.cost > 0 && !spendRef.current(target.cost, "build", `Palier ${target.title} ouvert`)) return;
    districtLevelRef.current = target.level;
    setDistrictLevel(target.level);
    toast.success(`${target.icon} ${target.title}`, { description: target.summary });
    persistNowRef.current();
  };


  const closeDialogue = () => {
    activeDialogueRef.current = null;
    setActiveDialogue(null);
    playerControllerRef.current?.setPaused(false);
  };

  const interactNearby = () => {
    const target = nearbyInteractionRef.current;
    if (!target || !walkingRef.current) return;
    activeDialogueRef.current = target;
    setActiveDialogue(target);
    playerControllerRef.current?.setPaused(true);
    playerControllerRef.current?.react();
  };

  const performDialogueAction = () => {
    const target = activeDialogueRef.current;
    if (!target) return;
    if (target.kind === "carWash") {
      const allRunning = Object.values(machinesRef.current).every(Boolean);
      if (!allRunning) {
        const next = { belt: true, rollers: true, brushes: true, traffic: true };
        machinesRef.current = next;
        setMachines(next);
        toast.success("🫧 Station remise en marche");
      } else {
        toast.success("⚙️ Toutes les machines fonctionnent correctement");
      }
    } else if (target.kind === "house") {
      toast.success("👋 Les habitants te saluent en retour !");
    } else if (target.kind === "vendor") {
      const price = target.price ?? 0;
      const grade = sanitizeRollerPartGrade(target.partGrade);
      if (rollerConditionRef.current >= 100 && rollerPartGradeRef.current === grade) {
        toast.info(`✅ Les rouleaux utilisent déjà ces ${PART_GRADE_META[grade].label.toLocaleLowerCase("fr-FR")}`);
      } else if (price <= 0 || economyRef.current.money < price) {
        toast.error(`Il manque ${Math.max(0, price - economyRef.current.money).toLocaleString("fr-FR")} € pour acheter les pièces`);
      } else {
        const qualityGain = rollerQualityLoss(rollerConditionRef.current);
        const next = { ...economyRef.current, money: economyRef.current.money - price };
        economyRef.current = next;
        setEconomy(next);
        rollerConditionRef.current = 100;
        setRollerCondition(100);
        rollerPartGradeRef.current = grade;
        setRollerPartGrade(grade);
        logRef.current(makeEvent("parts", `${PART_GRADE_META[grade].label} · ${target.title} · rouleaux niv. ${upgradesRef.current.speed} · qualité +${qualityGain} %`, -price, next.money));
        toast.success(`🔧 Rouleaux réparés · ${PART_GRADE_META[grade].label.toLocaleLowerCase("fr-FR")}`);
      }
    }
    playerControllerRef.current?.react();
    closeDialogue();
  };

  useEffect(() => {
    const onInteractionKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.code === "KeyE" && walkingRef.current && !activeDialogueRef.current) {
        event.preventDefault();
        interactNearby();
      }
      if (event.code === "Escape" && activeDialogueRef.current) {
        event.preventDefault();
        closeDialogue();
      }
    };
    window.addEventListener("keydown", onInteractionKey);
    return () => window.removeEventListener("keydown", onInteractionKey);
  }, []);

  const progression = nextMilestone(progress, {
    money: economy.money,
    washes: economy.washes,
    roads: planStats.roads,
    houses: city.houses,
    residents,
    decor: planStats.decor,
    upgrades,
  });
  useEffect(() => {
    if (!progression?.complete) return;
    const next = { unlocked: [...progressRef.current.unlocked, progression.id] };
    progressRef.current = next;
    setProgress(next);
    logRef.current(makeEvent("info", `${progression.title} débloqué`));
    toast.success(`${progression.icon} ${progression.title}`, { description: "La ville franchit une nouvelle étape." });
  }, [progression?.complete, progression?.id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "r" || !buildRef.current) return;
      setRot((r) => {
        const next = (r + 1) % 4;
        rotRef.current = next;
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);



  const [driveState, setDriveState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [driveMenuOpen, setDriveMenuOpen] = useState(false);
  const saveFn = saveToDrive;
  const loadFn = loadFromDrive;

  useEffect(() => {
    if (!driveMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-drive-menu]")) setDriveMenuOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [driveMenuOpen]);
  const cinemaStateRef = useRef(cinema);
  cinemaStateRef.current = cinema;

  /** Photographie complète de la partie (ville + progression). */
  const collectState = () => ({
    machines: machinesRef.current,
    cinema: cinemaStateRef.current,
    city: planIoRef.current.save(),
    houses: planIoRef.current.saveHouses(),
    decor: planIoRef.current.saveDecor(),
    washStyle: washStyleRef.current,
    residents: residentsRef.current,
    economy: economyRef.current,
    history: historyRef.current,
    upgrades: upgradesRef.current,
    clientBehavior: clientBehaviorRef.current,
    rollerCondition: rollerConditionRef.current,
    rollerPartGrade: rollerPartGradeRef.current,
    progress: progressRef.current,
    playerPosition: playerControllerRef.current?.position(),
    washMetrics: washMetricsRef.current,
    financePeriods: financePeriodsRef.current,
    playSeconds: playSecondsRef.current,
    activeUrbanEvent: activeUrbanEventRef.current,
    nextUrbanEventAt: nextUrbanEventAtRef.current,
    districtLevel: districtLevelRef.current,
    camera: cameraIoRef.current.save(),
  });

  type SavedState = {
    machines?: Partial<typeof machines>;
    cinema?: unknown;
    city?: SerializedPlan;
    houses?: SerializedHouses;
    decor?: SerializedDecor;
    washStyle?: unknown;
    residents?: unknown;
    economy?: { money?: unknown; washes?: unknown };
    history?: unknown;
    upgrades?: unknown;
    clientBehavior?: unknown;
    rollerCondition?: unknown;
    rollerPartGrade?: unknown;
    progress?: unknown;
    playerPosition?: unknown;
    washMetrics?: unknown;
    financePeriods?: unknown;
    playSeconds?: unknown;
    activeUrbanEvent?: unknown;
    nextUrbanEventAt?: unknown;
    districtLevel?: unknown;
    camera?: unknown;
  };

  /** Réapplique une sauvegarde (locale ou Drive) à la partie en cours. */
  const applySavedStateRef = useRef<(state: SavedState, withCinema?: boolean) => void>(
    () => {},
  );
  applySavedStateRef.current = (state: SavedState, withCinema = true) => {
    if (state.machines && typeof state.machines === "object") {
      setMachines((prev) => {
        const next = { ...prev };
        (Object.keys(prev) as Array<keyof typeof prev>).forEach((k) => {
          const v = state.machines?.[k];
          if (typeof v === "boolean") next[k] = v;
        });
        machinesRef.current = next;
        return next;
      });
    }
    if (Array.isArray(state.city)) planIoRef.current.load(state.city);
    if (Array.isArray(state.houses)) planIoRef.current.loadHouses(state.houses);
    if (Array.isArray(state.decor)) planIoRef.current.loadDecor(state.decor);
    if (state.washStyle) {
      const s = sanitizeWashStyle(state.washStyle);
      washStyleRef.current = s;
      setWashStyle(s);
      washApplyRef.current(s);
    }
    if (typeof state.residents === "number" && Number.isFinite(state.residents)) {
      const r = Math.max(0, Math.round(state.residents));
      residentsRef.current = r;
      setResidents(r);
    }
    if (state.economy && typeof state.economy === "object") {
      const money = state.economy.money;
      const washes = state.economy.washes;
      const next = {
        money:
          typeof money === "number" && Number.isFinite(money)
            ? Math.max(0, Math.round(money))
            : economyRef.current.money,
        washes:
          typeof washes === "number" && Number.isFinite(washes)
            ? Math.max(0, Math.round(washes))
            : economyRef.current.washes,
      };
      economyRef.current = next;
      setEconomy(next);
    }
    if (state.history !== undefined) {
      const h = sanitizeHistory(state.history);
      historyRef.current = h;
      setHistory(h);
    }
    if (state.upgrades) {
      const up = sanitizeUpgrades(state.upgrades);
      upgradesRef.current = up;
      setUpgrades(up);
    }
    const restoredClientBehavior = sanitizeClientBehavior(state.clientBehavior);
    clientBehaviorRef.current = restoredClientBehavior;
    setClientBehavior(restoredClientBehavior);
    const restoredCondition = sanitizeRollerCondition(state.rollerCondition);
    rollerConditionRef.current = restoredCondition;
    setRollerCondition(restoredCondition);
    const restoredPartGrade = sanitizeRollerPartGrade(state.rollerPartGrade);
    rollerPartGradeRef.current = restoredPartGrade;
    setRollerPartGrade(restoredPartGrade);
    if (state.progress) {
      const next = sanitizeCityProgress(state.progress);
      progressRef.current = next;
      setProgress(next);
    }
    if (state.playerPosition) playerControllerRef.current?.setPosition(state.playerPosition);
    const restoredMetrics = sanitizeWashMetrics(state.washMetrics);
    washMetricsRef.current = restoredMetrics;
    setWashMetrics(restoredMetrics);
    const restoredPeriods = sanitizeFinancePeriods(state.financePeriods);
    financePeriodsRef.current = restoredPeriods;
    setFinancePeriods(restoredPeriods);
    if (typeof state.playSeconds === "number" && Number.isFinite(state.playSeconds)) {
      playSecondsRef.current = Math.max(0, state.playSeconds);
      setPlaySeconds(playSecondsRef.current);
    }
    const restoredEvent = sanitizeUrbanEvent(state.activeUrbanEvent);
    activeUrbanEventRef.current = restoredEvent && restoredEvent.endsAt > Date.now() ? restoredEvent : null;
    setActiveUrbanEvent(activeUrbanEventRef.current);
    nextUrbanEventAtRef.current = typeof state.nextUrbanEventAt === "number" && Number.isFinite(state.nextUrbanEventAt) ? state.nextUrbanEventAt : Date.now() + 45_000;
    const restoredDistrict = sanitizeDistrictLevel(state.districtLevel);
    districtLevelRef.current = restoredDistrict;
    setDistrictLevel(restoredDistrict);
    if (state.camera) cameraIoRef.current.load(state.camera);
    if (
      withCinema &&
      typeof state.cinema === "boolean" &&
      state.cinema !== cinemaStateRef.current
    ) {
      cinemaRef.current();
    }
  };

  const handleManualSave = () => {
    saveLocalCity(collectState(), SAVE_VERSION);
    const saved = readLocalCity();
    setSavedAt(saved?.savedAt ?? new Date().toISOString());
    toast.success("💾 Partie sauvegardée maintenant");
  };

  const handleManualLoad = () => {
    const saved = readLocalCity();
    if (!saved) {
      toast.info("Aucune sauvegarde locale disponible.");
      return;
    }
    if (!window.confirm("Charger cette sauvegarde et remplacer la partie en cours ?")) return;
    applySavedStateRef.current(saved.state as SavedState);
    setSavedAt(saved.savedAt);
    toast.success("📥 Sauvegarde chargée", { description: new Date(saved.savedAt).toLocaleString("fr-FR") });
  };

  /* Sauvegarde locale automatique : la création du joueur est restaurée
     telle quelle au prochain lancement, sans action de sa part. */
  const localReadyRef = useRef(false);
  persistNowRef.current = () => {
    if (!localReadyRef.current) return;
    saveLocalCity(collectState(), SAVE_VERSION);
  };
  const restoreLocalRef = useRef<() => void>(() => {});
  restoreLocalRef.current = () => {
    const saved = readLocalCity();
    if (!saved) return;
    try {
      applySavedStateRef.current(saved.state as SavedState, false);
      setSavedAt(saved.savedAt);
      localReadyRef.current = true;
      toast.success("Ville restaurée", {
        description: "Ta dernière création a été rechargée automatiquement.",
      });
    } catch (err) {
      console.error(err);
      localReadyRef.current = true;
    }
  };

  useEffect(() => {
    const flush = () => persistNowRef.current();
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const timer = window.setInterval(flush, 4000);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      flush();
      window.clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveToDrive = async () => {
    setDriveState("saving");
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const res = await saveFn({
        data: {
          fileName: `tikowikocity-${stamp}.json`,
          payload: {
            version: SAVE_VERSION,
            app: "TikowikoCity",
            savedAt: new Date().toISOString(),
            // Extensible: new progression fields can be added here without
            // breaking older saves (loader applies only known keys).
            state: collectState(),
          },
        },
      });
      setDriveState("done");
      setDriveMenuOpen(false);
      toast.success("Sauvegardé sur Google Drive", {
        description: res.name,
        ...(res.webViewLink
          ? { action: { label: "Ouvrir", onClick: () => window.open(res.webViewLink, "_blank") } }
          : {}),
      });
      window.setTimeout(() => setDriveState("idle"), 4000);
    } catch (err) {
      console.error(err);
      setDriveState("error");
      toast.error("Échec de la sauvegarde sur Drive");
    }
  };

  const handleLoadFromDrive = async () => {
    setLoadState("loading");
    try {
      const res = await loadFn({ data: undefined });
      if (!res.found) {
        setLoadState("idle");
        toast.info("Aucune sauvegarde trouvée dans le dossier TikowikoCity.");
        return;
      }
      const state = JSON.parse(res.stateJson || "{}") as SavedState;
      applySavedStateRef.current(state);
      saveLocalCity(collectState(), SAVE_VERSION);

      setLoadState("done");
      setDriveMenuOpen(false);
      toast.success("Progression restaurée depuis Drive", { description: res.fileName });
      window.setTimeout(() => setLoadState("idle"), 4000);
    } catch (err) {
      console.error(err);
      setLoadState("error");
      toast.error(err instanceof Error ? err.message : "Échec du chargement depuis Drive");
    }
  };




  useEffect(() => {
    let mi = 0;
    const timer = window.setInterval(() => {
      mi = (mi + 1) % MESSAGES.length;
      setMessage(MESSAGES[mi]!);
    }, 900);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    let disposed = false;
    let frame = 0;
    let waterSurface: THREE.Mesh | null = null;
    

    /* GLTFLoader décode les textures via ImageBitmapLoader (fetch), ce que
       l'iframe de prévisualisation peut bloquer : on force le décodage <img>. */
    (window as unknown as { createImageBitmap?: unknown }).createImageBitmap = undefined;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xd9eefb, 260, 1100);

    /* Ciel dégradé (canvas) pour sortir du fond plat */
    const skyCanvas = document.createElement("canvas");
    skyCanvas.width = 4;
    skyCanvas.height = 256;
    const sctx = skyCanvas.getContext("2d")!;
    const grad = sctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, "#3fa9e8");
    grad.addColorStop(0.55, "#9fd8f5");
    grad.addColorStop(1, "#e9f6ff");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      fog: false,
      color: 0xffffff,
    });
    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 16), skyMat);
    scene.add(skyDome);
    const dayFog = new THREE.Color(0xd9eefb);
    const nightFog = new THREE.Color(0x0e2740);
    const daySkyTint = new THREE.Color(0xffffff);
    const nightSkyTint = new THREE.Color(0x0b1f38);

    /* Cadrage responsive : en portrait (mobile) on rapproche la caméra
       et on élargit le champ pour que la ville et le car wash remplissent l'écran. */
    const isPortrait = () => window.innerHeight >= window.innerWidth;
    const camera = new THREE.PerspectiveCamera(
      isPortrait() ? 50 : 45,
      window.innerWidth / window.innerHeight,
      0.1,
      2000,
    );
    if (isPortrait()) camera.position.set(-26, 36, WASH_SITE_Z + 54);
    // Cadrage desktop/paysage : caméra au nord-ouest de la route principale,
    // regard vers le sud-est. La ville (route principale + parcelles) occupe le
    // centre/premier plan, le car wash reste visible en arrière-plan relié par
    // la route, les montagnes restent lointaines.
    else camera.position.set(-22, 22, 8);


    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    wrap.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(
      isPortrait() ? -4 : 5,
      1.5,
      isPortrait() ? WASH_SITE_Z + 12 : -20,
    );
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 320;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.screenSpacePanning = false;
    controls.update();

    /* Vue initiale mémorisée pour le bouton « vue d'ensemble ». */
    const homePosition = camera.position.clone();
    const homeTarget = controls.target.clone();

    /* Réglages par défaut (vue du car wash) et réglages d'exploration libre. */
    const defaultTouches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    const freeTouches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
    const defaultMouse = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    const freeMouse = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = defaultTouches;
    controls.mouseButtons = defaultMouse;

    /* Limites de balade : on reste au-dessus du quartier, jamais dans le vide. */
    const PAN_LIMIT = 150;
    const clampTarget = () => {
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -PAN_LIMIT, PAN_LIMIT);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, WASH_SITE_Z - PAN_LIMIT, PAN_LIMIT);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, 0, 20);
    };

    /* Déplacement au clavier pendant l'exploration libre (flèches / ZQSD). */
    const panKeys = new Set<string>();
    const onFreeKeyDown = (e: KeyboardEvent) => {
      if (!freeCameraRef.current) return;
      panKeys.add(e.key.toLowerCase());
    };
    const onFreeKeyUp = (e: KeyboardEvent) => panKeys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onFreeKeyDown);
    window.addEventListener("keyup", onFreeKeyUp);
    const panVec = new THREE.Vector3();
    const forwardVec = new THREE.Vector3();
    const rightVec = new THREE.Vector3();
    const freeCameraPan = (dt: number) => {
      if (!freeCameraRef.current || panKeys.size === 0) return;
      const up = panKeys.has("arrowup") || panKeys.has("z") || panKeys.has("w");
      const down = panKeys.has("arrowdown") || panKeys.has("s");
      const left = panKeys.has("arrowleft") || panKeys.has("q") || panKeys.has("a");
      const right = panKeys.has("arrowright") || panKeys.has("d");
      if (!up && !down && !left && !right) return;
      camera.getWorldDirection(forwardVec);
      forwardVec.y = 0;
      forwardVec.normalize();
      rightVec.crossVectors(forwardVec, camera.up).normalize();
      panVec.set(0, 0, 0);
      if (up) panVec.add(forwardVec);
      if (down) panVec.sub(forwardVec);
      if (right) panVec.add(rightVec);
      if (left) panVec.sub(rightVec);
      if (panVec.lengthSq() === 0) return;
      const speed = camera.position.distanceTo(controls.target) * 0.9;
      panVec.normalize().multiplyScalar(speed * dt);
      camera.position.add(panVec);
      controls.target.add(panVec);
      clampTarget();
      controls.update();
    };
    freeCameraPanRef.current = freeCameraPan;

    cameraIoRef.current = {
      setFree: (on: boolean) => {
        controls.enabled = true;
        controls.enablePan = true;
        controls.screenSpacePanning = false;
        controls.maxDistance = on ? 320 : 160;
        controls.minPolarAngle = 0;
        controls.touches = on ? freeTouches : defaultTouches;
        controls.mouseButtons = on ? freeMouse : defaultMouse;
        renderer.domElement.style.touchAction = "none";
        if (!on) panKeys.clear();
        clampTarget();
        controls.update();
      },
      zoom: (direction: 1 | -1) => {
        const dir = camera.position.clone().sub(controls.target);
        const distance = dir.length();
        const next = THREE.MathUtils.clamp(
          distance * (direction > 0 ? 0.82 : 1.22),
          controls.minDistance,
          controls.maxDistance,
        );
        camera.position.copy(controls.target).add(dir.setLength(next));
        controls.update();
      },
      reset: () => {
        camera.position.copy(homePosition);
        controls.target.copy(homeTarget);
        controls.update();
      },
      focusWash: () => {
        controls.target.set(0, 1.5, WASH_SITE_Z);
        camera.position.set(14, 12, WASH_SITE_Z + 20);
        controls.update();
      },
      save: () => [
        camera.position.x,
        camera.position.y,
        camera.position.z,
        controls.target.x,
        controls.target.y,
        controls.target.z,
      ],
      load: (data: unknown) => {
        if (!Array.isArray(data) || data.length < 6) return;
        const nums = data.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));
        if (nums.some((v) => v === null)) return;
        camera.position.set(nums[0]!, nums[1]!, nums[2]!);
        controls.target.set(nums[3]!, nums[4]!, nums[5]!);
        controls.update();
      },
    };

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8fae7a, 0.9);
    scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff3d6, 1.6);
    sun.position.set(-15, 25, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0015;
    scene.add(sun);

    /* Lumière lunaire faible : la ville reste lisible sans transformer la nuit en jour. */
    const moon = new THREE.DirectionalLight(0x8eb8ff, 0);
    moon.position.set(20, 30, -20);
    scene.add(moon);

    /* Ces listes sont reconstruites avec le plan et servent au cycle nocturne. */
    const streetLampLights: THREE.PointLight[] = [];
    const houseLights: THREE.PointLight[] = [];
    const washLights: THREE.PointLight[] = [];
    const citizenTemplates: THREE.Object3D[] = [];

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshStandardMaterial({ color: 0x7fc76b, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);


    const setShadow = (obj: THREE.Object3D) => {
      obj.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });
    };

    const place = (
      template: THREE.Object3D,
      x: number,
      y: number,
      z: number,
      rotY = 0,
      scale = 1,
    ) => {
      const inst = template.clone(true);
      inst.position.set(x, y, z);
      inst.rotation.y = rotY;
      if (scale !== 1) inst.scale.setScalar(scale);
      setShadow(inst);
      scene.add(inst);
      return inst;
    };

    /* Les modèles Meshy sont exportés en Y-up mais avec une échelle et une
       orientation libres : on les tourne face à +X, on les met à l'échelle
       voulue et on les pose au sol. */
    const normalizeModel = (source: THREE.Object3D, targetLength: number) => {
      const root = new THREE.Group();
      const inner = new THREE.Group();
      inner.add(source);
      root.add(inner);

      const box0 = new THREE.Box3().setFromObject(inner);
      let box = box0;
      const size = box.getSize(new THREE.Vector3());


      // la plus grande dimension au sol suit l'axe X (sens de circulation)
      if (size.z > size.x) {
        inner.rotation.y = Math.PI / 2;
        inner.updateMatrixWorld(true);
        box = new THREE.Box3().setFromObject(inner);
      }


      const finalSize = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      inner.position.set(-center.x, -box.min.y, -center.z);
      root.scale.setScalar(targetLength / Math.max(finalSize.x, 0.0001));
      setShadow(root);
      return root;
    };



    type CarMaterialState = {
      material: THREE.MeshStandardMaterial;
      baseColor: THREE.Color;
      baseRoughness: number;
      baseMetalness: number;
      baseEmissive: THREE.Color;
      baseEmissiveIntensity: number;
    };

    const isolateMaterials = (car: THREE.Object3D) => {
      const materials: CarMaterialState[] = [];
      car.traverse((n) => {
        const mesh = n as THREE.Mesh;
        if (!mesh.isMesh) return;
        const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = source.map((raw) => {
          const m = (raw as THREE.MeshStandardMaterial).clone();
          materials.push({
            material: m,
            baseColor: m.color.clone(),
            baseRoughness: m.roughness,
            baseMetalness: m.metalness,
            baseEmissive: m.emissive.clone(),
            baseEmissiveIntensity: m.emissiveIntensity,
          });
          return m;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
      });
      return materials;
    };

    const tintCar = (car: THREE.Object3D, dirtiness: number) => {
      const data = car.userData as { materials?: CarMaterialState[] };
      const materials = data.materials ?? isolateMaterials(car);
      data.materials = materials;
      const dirt = THREE.MathUtils.clamp(dirtiness, 0, 1);
      materials.forEach((state) => {
        const m = state.material;
        m.color.copy(state.baseColor).lerp(DIRT_COLOR, dirt * 0.22);
        m.roughness = THREE.MathUtils.clamp(state.baseRoughness + dirt * 0.14, 0.08, 1);
        m.metalness = state.baseMetalness;
        m.emissive.copy(state.baseEmissive);
        m.emissiveIntensity = state.baseEmissiveIntensity;
      });
    };


    /* Anime uniquement les quatre roues en contact avec la route.
       Le SUV possède aussi une roue de secours arrière nommée "wheel-back" :
       l'ancien test partiel la faisait tourner comme une roue roulante. */
    const findWheels = (car: THREE.Object3D) => {
      const wheels: THREE.Object3D[] = [];
      const roadWheelName = /^wheel-(?:front|back)-(?:left|right)$/i;
      car.updateWorldMatrix(true, true);
      const carRight = new THREE.Vector3(1, 0, 0).transformDirection(
        car.matrixWorld,
      );
      car.traverse((n) => {
        if (roadWheelName.test(n.name)) {
          const axis = new THREE.Vector3(1, 0, 0).transformDirection(
            n.matrixWorld,
          );
          n.userData['spinSign'] = axis.dot(carRight) < 0 ? -1 : 1;
          wheels.push(n);
        }
      });
      return wheels;
    };


    /* Rouleau de lavage : axe central + manchon de mousse sombre nervuré.
       On évite les milliers de micro-poils colorés qui produisaient un
       scintillement type « neige TV » une fois le rouleau mis à l'échelle. */
    const brushCoreMat = new THREE.MeshStandardMaterial({
      color: 0x9aa3ad,
      roughness: 0.5,
      metalness: 0.35,
    });
    const brushPadMat = new THREE.MeshStandardMaterial({
      color: 0x2b2f36,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    });
    const brushRibMat = new THREE.MeshStandardMaterial({
      color: 0x1f6f9c,
      roughness: 0.85,
    });
    const brushCoreGeo = new THREE.CylinderGeometry(0.09, 0.09, 1.9, 12);
    const brushPadGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.62, 16, 1);
    const brushRibGeo = new THREE.TorusGeometry(0.31, 0.035, 8, 20);
    /* Lanières souples accrochées au rouleau : fines lamelles qui pendent
       et viennent frotter la carrosserie. */
    const flapGeo = new THREE.BoxGeometry(0.045, 0.5, 0.16);
    flapGeo.translate(0, -0.25, 0);
    const flapMats = [0x2f7fb4, 0x67c3ea, 0xe8eef2].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }),
    );

    const makeBrush = () => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(brushCoreGeo, brushCoreMat);
      core.castShadow = true;
      g.add(core);

      const pad = new THREE.Mesh(brushPadGeo, brushPadMat);
      pad.castShadow = true;
      g.add(pad);

      // quelques nervures espacées : lisible, sans bruit visuel
      for (let i = 0; i < 5; i++) {
        const rib = new THREE.Mesh(brushRibGeo, brushRibMat);
        rib.rotation.x = Math.PI / 2;
        rib.position.y = -0.62 + i * 0.31;
        g.add(rib);
      }

      /* Couronnes de lanières réparties sur la hauteur du rouleau. */
      const flaps = new THREE.Group();
      for (let row = 0; row < 4; row++) {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 + row * 0.31;
          const f = new THREE.Mesh(flapGeo, flapMats[(row + k) % flapMats.length]!);
          f.position.set(Math.cos(a) * 0.3, 0.62 - row * 0.4, Math.sin(a) * 0.3);
          f.rotation.y = -a;
          f.rotation.z = 0.35;
          f.userData['a0'] = a;
          f.userData['row'] = row;
          flaps.add(f);
        }
      }
      g.add(flaps);
      g.userData['flaps'] = flaps;
      return g;
    };


    const makeFoamVeil = () => {
      const group = new THREE.Group();
      const geo = new THREE.SphereGeometry(1, 6, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        roughness: 0.4,
      });
      for (let i = 0; i < 26; i++) {
        const s = new THREE.Mesh(geo, mat);
        s.scale.setScalar(0.05 + Math.random() * 0.12);
        s.position.set(
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 1.6,
          (Math.random() - 0.5) * 0.6,
        );
        group.add(s);
      }
      return group;
    };

    /* Rampe de gicleurs : buse + nappe d'eau translucide + gouttelettes
       animées qui retombent sur la carrosserie. */
    const nozzleMat = new THREE.MeshStandardMaterial({
      color: 0x8f9aa6,
      roughness: 0.4,
      metalness: 0.6,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x9fd8f5,
      transparent: true,
      opacity: 0.32,
      roughness: 0.1,
      depthWrite: false,
    });
    const dropMat = new THREE.MeshStandardMaterial({
      color: 0xcdeeff,
      transparent: true,
      opacity: 0.8,
      roughness: 0.15,
    });
    const nozzleGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.22, 8);
    const jetGeo = new THREE.ConeGeometry(0.42, 1.5, 10, 1, true);
    const dropGeo = new THREE.SphereGeometry(0.05, 5, 4);

    type WaterJet = { group: THREE.Group; drops: THREE.Mesh[]; cone: THREE.Mesh };
    const makeWaterJet = () => {
      const group = new THREE.Group();
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      group.add(nozzle);
      const cone = new THREE.Mesh(jetGeo, waterMat);
      cone.position.y = -0.85;
      cone.rotation.x = Math.PI; // pointe vers le bas
      group.add(cone);
      const drops: THREE.Mesh[] = [];
      for (let i = 0; i < 12; i++) {
        const d = new THREE.Mesh(dropGeo, dropMat);
        d.userData['t'] = Math.random();
        d.userData['ox'] = (Math.random() - 0.5) * 0.5;
        d.userData['oz'] = (Math.random() - 0.5) * 0.5;
        drops.push(d);
        group.add(d);
      }
      return { group, drops, cone } as WaterJet;
    };

    /* Nappe de mousse qui vient recouvrir la carrosserie pendant le lavage. */
    const soapMat = new THREE.MeshStandardMaterial({
      color: 0xf5fbff,
      transparent: true,
      opacity: 0.48,
      roughness: 0.35,
      depthWrite: false,
    });
    const soapGeo = new THREE.IcosahedronGeometry(0.13, 0);
    const makeSoapCoat = () => {
      const g = new THREE.Group();
      for (let i = 0; i < 14; i++) {
        const b = new THREE.Mesh(soapGeo, soapMat);
        const a = Math.random() * Math.PI * 2;
        b.position.set(
          (Math.random() - 0.5) * 2.5,
          0.28 + Math.random() * 0.65,
          Math.cos(a) * (0.42 + Math.random() * 0.22),
        );
        b.userData['s'] = 0.5 + Math.random() * 0.8;
        b.scale.setScalar(0.001);
        g.add(b);
      }
      g.visible = false;
      return g;
    };



    const makeTree = () => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.13, 0.18, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x7a5230 }),
      );
      trunk.position.y = 0.55;
      trunk.castShadow = true;
      g.add(trunk);

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9142, roughness: 1 });
      const leafGeo = new THREE.IcosahedronGeometry(0.85, 0);
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set((Math.random() - 0.5) * 0.4, 1.2 + i * 0.5, (Math.random() - 0.5) * 0.4);
        leaf.scale.setScalar(1 - i * 0.18);
        leaf.castShadow = true;
        g.add(leaf);
      }
      return g;
    };

    /* ---------- Décor naturel : collines, montagnes, lac ---------- */
    const rand = (() => {
      let seed = 1337;
      return () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    })();

    const buildLandscape = () => {
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b8f96, roughness: 1, flatShading: true });
      const rockDark = new THREE.MeshStandardMaterial({ color: 0x6f747c, roughness: 1, flatShading: true });
      const snowMat = new THREE.MeshStandardMaterial({ color: 0xf3f8ff, roughness: 0.9, flatShading: true });
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x6bb85c, roughness: 1, flatShading: true });
      const hillMat2 = new THREE.MeshStandardMaterial({ color: 0x58a552, roughness: 1, flatShading: true });

      // Chaîne de montagnes lointaine, sur tout l'horizon (bien au-delà de la ville)
      for (let i = 0; i < 64; i++) {
        const a = (i / 64) * Math.PI * 2 + rand() * 0.06;
        const r = 340 + rand() * 150;
        const h = 70 + rand() * 110;
        const rad = h * (0.6 + rand() * 0.35);
        const m = new THREE.Mesh(
          new THREE.ConeGeometry(rad, h, 5 + Math.floor(rand() * 3), 1),
          rand() > 0.5 ? rockMat : rockDark,
        );
        m.position.set(Math.cos(a) * r, h / 2 - 4, Math.sin(a) * r);
        m.rotation.y = rand() * Math.PI;
        scene.add(m);
        if (h > 110) {
          const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.34, h * 0.24, 6, 1), snowMat);
          cap.position.set(m.position.x, h - h * 0.12 - 4, m.position.z);
          cap.rotation.y = m.rotation.y;
          scene.add(cap);
        }
      }

      // Collines verdoyantes, basses, en avant-plan des montagnes
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2 + rand() * 0.14;
        const r = 245 + rand() * 80;
        const h = 7 + rand() * 13;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        // on dégage la vallée du lac
        if (Math.hypot(x + 62, z - 34) < 110) continue;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(h * 2.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
          rand() > 0.5 ? hillMat : hillMat2,
        );
        m.scale.y = 0.3 + rand() * 0.2;
        m.position.set(x, -1, z);
        scene.add(m);
      }


      // Buttes douces éparses : casse la platitude entre ville et collines
      for (let i = 0; i < 22; i++) {
        const a = rand() * Math.PI * 2;
        const r = 120 + rand() * 70;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.hypot(x, z + 42) < 60) continue; // dégage le terrain du car wash
        if (Math.hypot(x + 62, z - 34) < 60) continue; // dégage le lac
        const h = 4 + rand() * 9;
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(h * 2.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
          rand() > 0.5 ? hillMat : hillMat2,
        );
        m.scale.y = 0.3 + rand() * 0.22;
        m.position.set(x, -0.6, z);
        scene.add(m);
      }



      // Lac au nord-ouest + plage et arbres
      const lake = new THREE.Group();
      const sand = new THREE.Mesh(
        new THREE.CircleGeometry(22, 40),
        new THREE.MeshStandardMaterial({ color: 0xe4d6a8, roughness: 1 }),
      );
      sand.rotation.x = -Math.PI / 2;
      sand.position.y = 0.02;
      lake.add(sand);
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(18.5, 48),
        new THREE.MeshStandardMaterial({
          color: 0x3fa9d8,
          roughness: 0.15,
          metalness: 0.35,
          transparent: true,
          opacity: 0.92,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = 0.05;
      lake.add(water);
      lake.position.set(-62, 0, 34);
      lake.scale.set(1.25, 1, 0.85);
      scene.add(lake);
      waterSurface = water;

      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const tr = makeTree();
        tr.position.set(
          -62 + Math.cos(a) * (28 + rand() * 6) * 1.25,
          0,
          34 + Math.sin(a) * (24 + rand() * 6) * 0.85,
        );
        tr.scale.setScalar(0.9 + rand() * 0.5);
        setShadow(tr);
        scene.add(tr);
      }

      // Bosquets épars entre la ville et les collines
      for (let i = 0; i < 46; i++) {
        const a = rand() * Math.PI * 2;
        const r = 58 + rand() * 55;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.abs(x) < 40 && Math.abs(z) < 52) continue;
        const tr = makeTree();
        tr.position.set(x, 0, z);
        tr.scale.setScalar(0.8 + rand() * 0.7);
        setShadow(tr);
        scene.add(tr);
      }

      /* Promenade en diagonale : casse la rigidité du quadrillage,
         relie l'angle nord-ouest de la ville au lac. */
      const from = new THREE.Vector2(-32, 24);
      const to = new THREE.Vector2(-50, 34);
      const dir = to.clone().sub(from);
      const promenade = new THREE.Mesh(
        new THREE.PlaneGeometry(dir.length() + 14, 4.4),
        new THREE.MeshStandardMaterial({ color: 0xd8cfae, roughness: 1 }),
      );
      promenade.rotation.x = -Math.PI / 2;
      promenade.rotation.z = -Math.atan2(dir.y, dir.x);
      promenade.position.set((from.x + to.x) / 2, 0.03, (from.y + to.y) / 2);
      promenade.receiveShadow = true;
      scene.add(promenade);
    };



    /* ---------- Mobilier urbain : modèles Kenney ---------- */



    type TrafficLight = { axis: "x" | "z"; red: THREE.Mesh; green: THREE.Mesh };
    const trafficLights: TrafficLight[] = [];

    /* Feu tricolore Kenney (city-kit-roads) + deux ampoules émissives pour
       pouvoir piloter le cycle rouge/vert. */
    const makeTrafficLight = (axis: "x" | "z") => {
      const g = new THREE.Group();
      const model = kit["traffic-light"];
      if (model) {
        const inst = model.clone(true);
        inst.scale.setScalar(6);
        g.add(inst);
      }
      const bulb = (color: number, y: number) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 10, 10),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.2 }),
        );
        m.position.set(0, y, 0.28);
        g.add(m);
        return m;
      };
      const red = bulb(0xff3b30, 2.75);
      const green = bulb(0x33d17a, 2.25);
      trafficLights.push({ axis, red, green });
      return g;
    };



    // Tapis roulant : lattes qui défilent dans la zone de lavage
    const makeConveyor = () => {
      const group = new THREE.Group();
      const [zs, ze] = WASH_ZONE;
      const len = ze - zs;
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(len, 0.12, 2.6),
        new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 0.8 }),
      );
      base.position.set((zs + ze) / 2, ROAD_Y + 0.06, 0);
      base.receiveShadow = true;
      group.add(base);

      const slatMat = new THREE.MeshStandardMaterial({ color: 0x596470, roughness: 0.6 });
      const slatGeo = new THREE.BoxGeometry(0.18, 0.06, 2.4);
      const slats: THREE.Mesh[] = [];
      const count = Math.round(len / 0.4);
      for (let i = 0; i < count; i++) {
        const s = new THREE.Mesh(slatGeo, slatMat);
        s.position.set(zs + i * 0.4, ROAD_Y + 0.14, 0);
        s.castShadow = true;
        group.add(s);
        slats.push(s);
      }
      return { group, slats };
    };

    const models: Record<string, THREE.Group> = {};
    /* Modèles Kenney extraits du pack : routes, voitures, bâtiments, mobilier */
    const kit: Record<string, THREE.Object3D> = {};
    const kitCar = (i: number) => {
      const name = KIT_CARS[i % KIT_CARS.length]!;
      return kit[name] ?? kit["sedan"] ?? models["sedan"]!;
    };

    type WashCar = {
      car: THREE.Object3D;
      d: number;
      speed: number;
      yaw: number;
      baseY: number;
      wheels: THREE.Object3D[];
      /* voiture du réseau empruntée : elle repart circuler après le lavage */
      origin: NetCar;
      /* true dès que le lavage a été facturé (évite les doubles paiements) */
      paid?: boolean;
      /* nappe de mousse qui recouvre la carrosserie pendant le lavage */
      soap?: THREE.Group;

    };
    const washCars: WashCar[] = [];


    const brushes: Array<{
      pivot: THREE.Object3D;
      spin: THREE.Object3D;
      dir: number;
      kind: "roller" | "brush";
    }> = [];
    const waterJets: WaterJet[] = [];
    const foamSprites: THREE.Object3D[] = [];

    const conveyorSlats: THREE.Mesh[] = [];
    /* ----- Réseau routier du joueur ----- */
    const plan = new CityPlan();
    let stopAutoCityGrowth: (() => void) | null = null;
    let interactionScan = 0;
    const MAIN_CX = Math.round(WASH_ACCESS_X / TILE);
    const MAIN_CZ_START = -5; // première case au nord de la parcelle
    const MAIN_CZ_END = 12; // s'enfonce vers les reliefs du fond
    const LANE = 1.5;

    /* Voiture circulant de case en case sur le réseau construit. */
    type NetCar = {
      car: THREE.Object3D;
      wheels: THREE.Object3D[];
      speed: number;
      baseY: number;
      yaw: number;
      cx: number;
      cz: number;
      dirIn: Dir;
      dirOut: Dir;
      /** progression dans la case courante (0 → 1) */
      t: number;
    };
    const netCars: NetCar[] = [];

    /* Position/cap d'une voiture : courbe quadratique entrée → sortie de case,
       décalée à droite pour rester sur sa voie, y compris dans les virages. */
    const netPose = (e: NetCar) => {
      const cxw = e.cx * TILE;
      const czw = e.cz * TILE;
      const vin = DIR_VEC[e.dirIn]!;
      const vout = DIR_VEC[e.dirOut]!;
      const rin = rightOf(e.dirIn);
      const rout = rightOf(e.dirOut);
      const ax = cxw - (vin[0] * TILE) / 2 + rin[0] * LANE;
      const az = czw - (vin[1] * TILE) / 2 + rin[1] * LANE;
      const bx = cxw + (vout[0] * TILE) / 2 + rout[0] * LANE;
      const bz = czw + (vout[1] * TILE) / 2 + rout[1] * LANE;
      const ccx = cxw + ((rin[0] + rout[0]) * LANE) / 2;
      const ccz = czw + ((rin[1] + rout[1]) * LANE) / 2;
      const u = 1 - e.t;
      const x = u * u * ax + 2 * u * e.t * ccx + e.t * e.t * bx;
      const z = u * u * az + 2 * u * e.t * ccz + e.t * e.t * bz;
      const dx = 2 * u * (ccx - ax) + 2 * e.t * (bx - ccx);
      const dz = 2 * u * (ccz - az) + 2 * e.t * (bz - ccz);
      return { x, z, heading: Math.atan2(dx, dz) };
    };

    /* Toute la station de lavage (tunnel, tapis, brosses, voitures à laver)
       vit dans ce groupe : ses coordonnées locales restent inchangées. */
    const washSite = new THREE.Group();
    washSite.position.z = WASH_SITE_Z;
    scene.add(washSite);
    /* Ancien portique provisoire : plus aucun modèle temporaire n'est ajouté
       à la scène, seul le tunnel détaillé est monté après chargement. */


    /* Rendu du plan : tuiles de route auto-raccordées + mobilier posé. */
    const roadsGroup = new THREE.Group();
    scene.add(roadsGroup);
    const propsGroup = new THREE.Group();
    scene.add(propsGroup);

    const housesGroup = new THREE.Group();
    scene.add(housesGroup);

    /* Maisons assemblées avec les vrais modules du building-kit Kenney.
       On conserve les textures/materials du pack au lieu de recréer une fausse maison. */
    const KENNEY_CELL = 2;
    const KENNEY_FLOOR_H = 2.4;
    const makeHouse = (level: number) => {
      const g = new THREE.Group();
      const floorTpl = kit["floor"] ?? models["hFloor"];
      const wallTpl = kit["wall-window-square"] ?? models["hWallWindow"];
      const roofTpl = kit["roof-flat-center"] ?? floorTpl;
      const doorTpl = kit["wall-doorway-square"] ?? wallTpl;
      if (!floorTpl || !wallTpl || !roofTpl || !doorTpl) return g;

      const cols = level === 1 ? 1 : 2;
      const rows = level >= 3 ? 2 : 1;
      const floors = level;
      const ox = (-(cols - 1) * KENNEY_CELL) / 2;
      const oz = (-(rows - 1) * KENNEY_CELL) / 2;

      const clonePart = (tpl: THREE.Object3D) => {
        const obj = tpl.clone(true);
        obj.traverse((n) => {
          const mesh = n as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mesh.material = mats.map((base) => {
            const mat = base.clone() as THREE.MeshStandardMaterial;
            const tag = `${mesh.name} ${mat.name}`.toLowerCase();
            if (tag.includes("window") || tag.includes("glass")) {
              mat.emissive = new THREE.Color(0xffc56e);
              mat.emissiveIntensity = 0.08;
              mat.userData['nightWindow'] = true;
            }
            return mat;
          }) as unknown as THREE.Material;
          if (Array.isArray(mesh.material) && (mesh.material as THREE.Material[]).length === 1) {
            mesh.material = (mesh.material as THREE.Material[])[0]!;
          }
        });
        return obj;
      };

      for (let f = 0; f < floors; f++) {
        const y = f * KENNEY_FLOOR_H;
        for (let i = 0; i < cols; i++) {
          for (let j = 0; j < rows; j++) {
            const x = ox + i * KENNEY_CELL;
            const z = oz + j * KENNEY_CELL;
            const slab = clonePart(floorTpl);
            slab.position.set(x, y, z);
            g.add(slab);
            const wall = (wx: number, wz: number, wr: number, door = false) => {
              const w = clonePart(door ? doorTpl : wallTpl);
              w.position.set(wx, y, wz);
              w.rotation.y = wr;
              g.add(w);
            };
            if (i === 0) wall(x - KENNEY_CELL / 2, z, 0);
            if (i === cols - 1) wall(x + KENNEY_CELL / 2, z, 0);
            if (j === 0) wall(x, z - KENNEY_CELL / 2, Math.PI / 2, f === 0 && i === 0);
            if (j === rows - 1) wall(x, z + KENNEY_CELL / 2, Math.PI / 2);
          }
        }
      }
      const top = floors * KENNEY_FLOOR_H;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const roof = clonePart(roofTpl);
          roof.position.set(ox + i * KENNEY_CELL, top, oz + j * KENNEY_CELL);
          g.add(roof);
        }
      }
      setShadow(g);
      return g;
    };

    const renderHouses = () => {
      [...housesGroup.children].forEach((c) => housesGroup.remove(c));
      houseLights.length = 0;
      plan.houses.forEach((h, k) => {
        const [cx, cz] = parseKey(k);
        const m = makeHouse(h.level);
        m.scale.setScalar(1.55);
        m.position.set(cx * TILE, 0, cz * TILE);
        m.rotation.y = ((h.rot ?? 0) * Math.PI) / 2;

        /* Une lumière chaude par logement : elle s'allume uniquement la nuit. */
        const homeLight = new THREE.PointLight(0xffc56e, 0, 18 + h.level * 3, 1.6);
        homeLight.position.set(0, Math.min(5.4, 1.8 + h.level * 1.05), 0);
        m.add(homeLight);
        houseLights.push(homeLight);
        housesGroup.add(m);
      });
      cityStatsRef.current(plan.houseLevels());
      pedestrianRef.current?.refresh();
    };

    /* ---------- Décor du joueur : parcs et parkings ---------- */
    const decorGroup = new THREE.Group();
    scene.add(decorGroup);

    const grassMat = new THREE.MeshStandardMaterial({ color: 0x74c46a, roughness: 1 });
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xe3cf9c, roughness: 1 });
    const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x6d747c, roughness: 1 });
    const paintMat = new THREE.MeshStandardMaterial({ color: 0xf3f2ea, roughness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a34, roughness: 0.9 });

    const groundTile = (mat: THREE.Material, size = TILE * 0.96, y = 0.02) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      m.receiveShadow = true;
      return m;
    };

    const makeBench = () => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.5), woodMat);
      seat.position.y = 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.12), woodMat);
      back.position.set(0, 0.72, -0.2);
      g.add(seat, back);
      return g;
    };

    const makeDecor = (kind: DecorKind, seed: number) => {
      const g = new THREE.Group();
      const rnd = (i: number) => ((Math.sin(seed * 12.9898 + i * 78.233) + 1) % 1);
      if (kind === "park" || kind === "garden" || kind === "fountain" || kind === "playground") {
        g.add(groundTile(grassMat));
      }
      if (kind === "park") {
        for (let i = 0; i < 4; i++) {
          const t = makeTree();
          t.position.set((rnd(i) - 0.5) * 4.4, 0, (rnd(i + 9) - 0.5) * 4.4);
          t.scale.setScalar(0.8 + rnd(i + 3) * 0.4);
          g.add(t);
        }
        const b = makeBench();
        b.position.set(1.4, 0, 1.9);
        b.rotation.y = Math.PI;
        g.add(b);
      } else if (kind === "garden") {
        const flowerMats = [0xe4657a, 0xf0c246, 0xa46ee0, 0xffffff].map(
          (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }),
        );
        const bed = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.72, 0.22, TILE * 0.72),
          new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 }),
        );
        bed.position.y = 0.11;
        g.add(bed);
        for (let i = 0; i < 16; i++) {
          const f = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 8, 8),
            flowerMats[i % flowerMats.length]!,
          );
          f.position.set((rnd(i) - 0.5) * 3.8, 0.3, (rnd(i + 5) - 0.5) * 3.8);
          g.add(f);
        }
        const b = makeBench();
        b.position.set(0, 0, 2.3);
        g.add(b);
      } else if (kind === "fountain") {
        const basin = new THREE.Mesh(
          new THREE.CylinderGeometry(2, 2.2, 0.5, 20),
          new THREE.MeshStandardMaterial({ color: 0xd8d3c6, roughness: 0.9 }),
        );
        basin.position.y = 0.25;
        const water = new THREE.Mesh(
          new THREE.CylinderGeometry(1.75, 1.75, 0.1, 20),
          new THREE.MeshStandardMaterial({
            color: 0x4fb3e8,
            roughness: 0.15,
            metalness: 0.1,
          }),
        );
        water.position.y = 0.52;
        const jet = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.24, 1.5, 10),
          new THREE.MeshStandardMaterial({ color: 0xbfe6f7, roughness: 0.3 }),
        );
        jet.position.y = 1.2;
        g.add(basin, water, jet);
      } else if (kind === "playground") {
        g.add(groundTile(sandMat, TILE * 0.7, 0.025));
        const frameMat = new THREE.MeshStandardMaterial({ color: 0xe0574c, roughness: 0.7 });
        const slide = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 3.2), frameMat);
        slide.position.set(-1.2, 0.9, 0);
        slide.rotation.x = 0.5;
        const tower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.4), woodMat);
        tower.position.set(-1.2, 0.8, -1.9);
        const barMat = new THREE.MeshStandardMaterial({ color: 0x3f7fae, roughness: 0.6 });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 3), barMat);
        bar.position.set(1.6, 1.6, 0);
        for (const sz of [-1.4, 1.4]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 0.16), barMat);
          leg.position.set(1.6, 0.85, sz);
          g.add(leg);
        }
        for (const sz of [-0.6, 0.6]) {
          const swing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.3), frameMat);
          swing.position.set(1.6, 0.55, sz);
          g.add(swing);
        }
        g.add(slide, tower, bar);
      } else if (kind === "parking" || kind === "truckstop") {
        g.add(groundTile(tarmacMat));
        const slots = kind === "truckstop" ? 3 : 4;
        const step = (TILE * 0.9) / slots;
        for (let i = 0; i <= slots; i++) {
          const line = new THREE.Mesh(
            new THREE.PlaneGeometry(0.14, TILE * 0.72),
            paintMat,
          );
          line.rotation.x = -Math.PI / 2;
          line.position.set(-TILE * 0.45 + i * step, 0.03, 0);
          g.add(line);
        }
        const parkedCount = kind === "truckstop" ? 1 : 2;
        for (let i = 0; i < parkedCount; i++) {
          const c = kitCar(Math.floor(rnd(i) * 8) + i).clone(true);
          c.rotation.y = Math.PI / 2;
          if (kind === "truckstop") c.scale.setScalar(1.4);
          c.position.set(-TILE * 0.45 + step * (i + 0.5) + step * i, 0.02, 0);
          g.add(c);
        }
      } else if (kind === "carport") {
        g.add(groundTile(tarmacMat));
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(TILE * 0.9, 0.22, TILE * 0.7),
          new THREE.MeshStandardMaterial({ color: 0xcfd6de, roughness: 0.6 }),
        );
        roof.position.y = 2.7;
        g.add(roof);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a929b, roughness: 0.8 });
        for (const sx of [-TILE * 0.4, TILE * 0.4]) {
          for (const sz of [-TILE * 0.3, TILE * 0.3]) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.7, 0.24), pillarMat);
            p.position.set(sx, 1.35, sz);
            g.add(p);
          }
        }
        const c = kitCar(Math.floor(rnd(2) * 8)).clone(true);
        c.rotation.y = Math.PI / 2;
        c.position.set(0, 0.02, 0);
        g.add(c);
      }
      setShadow(g);
      return g;
    };

    const renderDecor = () => {
      [...decorGroup.children].forEach((c) => decorGroup.remove(c));
      plan.decor.forEach((d, k) => {
        const [cx, cz] = parseKey(k);
        const obj = makeDecor(d.kind, cx * 31 + cz * 17);
        obj.position.set(cx * TILE, 0, cz * TILE);
        obj.rotation.y = (d.rot * Math.PI) / 2;
        decorGroup.add(obj);
      });
      const parking = [...plan.decor.values()].filter((item) => item.kind === "parking" || item.kind === "carport" || item.kind === "truckstop").length;
      neighborhoodRef.current.parking = parking;
      setPlanStats((prev) => ({ ...prev, decor: plan.decor.size, parking }));
      pedestrianRef.current?.refresh();
    };

    freeBuildingRef.current = () => {
      const candidates = [
        [MAIN_CX - 1, MAIN_CZ_START + 4], [MAIN_CX + 1, MAIN_CZ_START + 5],
        [MAIN_CX - 2, MAIN_CZ_START + 7], [MAIN_CX + 2, MAIN_CZ_START + 8],
        [MAIN_CX - 1, MAIN_CZ_START + 10], [MAIN_CX + 1, MAIN_CZ_START + 11],
      ] as const;
      for (const [cx, cz] of candidates) {
        if (plan.canPlaceHouse(cx, cz)) {
          plan.placeHouse(cx, cz, Math.min(3, 1 + Math.floor(economyRef.current.washes / 12)), 0);
          renderHouses();
          persistNowRef.current();
          return `Une nouvelle résidence ouvre en ${cx}, ${cz}`;
        }
      }
      for (const [cx, cz] of candidates) {
        if (plan.canPlaceDecor(cx, cz)) {
          plan.placeDecor(cx, cz, Math.random() > 0.45 ? "park" : "parking", 0);
          renderDecor();
          persistNowRef.current();
          return `Un nouvel aménagement ouvre en ${cx}, ${cz}`;
        }
      }
      return null;
    };

    /* ---------- Personnalisation du car wash ---------- */
    const washDecor = new THREE.Group();
    washDecor.position.z = WASH_SITE_Z;
    scene.add(washDecor);

    const signTexture = (label: string, hex: number) => {
      const cv = document.createElement("canvas");
      cv.width = 512;
      cv.height = 160;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = `#${hex.toString(16).padStart(6, "0")}`;
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 76px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label.slice(0, 16).toUpperCase(), cv.width / 2, cv.height / 2 + 4);
      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      return tex;
    };

    const rebuildWashDecor = (style: WashStyle) => {
      [...washDecor.children].forEach((c) => washDecor.remove(c));
      washLights.length = 0;
      const hex = WASH_COLORS[style.color]?.hex ?? WASH_COLORS[0]!.hex;
      const themeMat = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.65 });

      // auvent coloré au-dessus de l'entrée : la couleur du car wash
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 4), themeMat);
      canopy.position.set(0, 4.6, -3.4);
      washDecor.add(canopy);
      for (const sx of [-4, 4]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.18, 4.6, 10),
          themeMat,
        );
        post.position.set(sx, 2.3, -3.4);
        washDecor.add(post);
      }

      if (style.sign) {
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(9, 2.6),
          new THREE.MeshBasicMaterial({
            map: signTexture(`${player?.name ?? "Tikowiko"} WASH`, hex),
            side: THREE.DoubleSide,
          }),
        );
        panel.position.set(0, 6.4, -3.4);
        washDecor.add(panel);
        const signLight = new THREE.PointLight(hex, 0, 20, 1.7);
        signLight.position.set(0, 6, -2.4);
        washDecor.add(signLight);
        washLights.push(signLight);
        for (const sx of [-4, 4]) {
          const mast = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 1.6, 0.2),
            themeMat,
          );
          mast.position.set(sx, 5.3, -3.4);
          washDecor.add(mast);
        }
      }

      if (style.neon) {
        const glow = new THREE.Mesh(
          new THREE.TorusGeometry(2.4, 0.14, 8, 28),
          new THREE.MeshStandardMaterial({
            color: hex,
            emissive: hex,
            emissiveIntensity: 1.6,
            roughness: 0.3,
          }),
        );
        glow.position.set(0, 3.2, 3.6);
        washDecor.add(glow);
        const lamp = new THREE.PointLight(hex, 18, 22);
        lamp.position.set(0, 3.4, 3.6);
        washDecor.add(lamp);
      }

      if (style.plants) {
        const potMat = new THREE.MeshStandardMaterial({ color: 0xc96a4e, roughness: 0.9 });
        for (const [px, pz] of [
          [-9, -5],
          [9, -5],
          [-9, 4],
          [9, 4],
        ] as const) {
          const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.9, 12), potMat);
          pot.position.set(px, 0.45, pz);
          const bush = new THREE.Mesh(
            new THREE.IcosahedronGeometry(0.85, 0),
            new THREE.MeshStandardMaterial({ color: 0x3f9142, roughness: 1 }),
          );
          bush.position.set(px, 1.5, pz);
          washDecor.add(pot, bush);
        }
      }

      if (style.flags) {
        const flagMat = new THREE.MeshStandardMaterial({
          color: hex,
          roughness: 0.8,
          side: THREE.DoubleSide,
        });
        for (let i = 0; i < 10; i++) {
          const x = -13.5 + i * 3;
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 3.2, 6),
            new THREE.MeshStandardMaterial({ color: 0xd7dbe0, roughness: 0.5 }),
          );
          pole.position.set(x, 1.6, 6.2);
          const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.7), flagMat);
          flag.position.set(x + 0.55, 2.9, 6.2);
          washDecor.add(pole, flag);
        }
      }

      for (const [x, z] of [[-8, -5], [8, -5], [-8, 5], [8, 5]] as const) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.07, 0.1, 3.7, 8),
          new THREE.MeshStandardMaterial({ color: 0x58636d, roughness: 0.55 }),
        );
        pole.position.set(x, 1.85, z);
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0xffe8ae, emissive: 0xffc85c, emissiveIntensity: 0.2 }),
        );
        bulb.position.set(x, 3.75, z);
        const light = new THREE.PointLight(0xffd88a, 0, 18, 1.7);
        light.position.set(x, 3.65, z);
        washDecor.add(pole, bulb, light);
        washLights.push(light);
      }

      setShadow(washDecor);
    };
    washApplyRef.current = rebuildWashDecor;
    rebuildWashDecor(washStyleRef.current);


    const renderPlan = () => {
      [...roadsGroup.children].forEach((c) => roadsGroup.remove(c));
      [...propsGroup.children].forEach((c) => propsGroup.remove(c));
      trafficLights.length = 0;
      streetLampLights.length = 0;
      plan.cells.forEach((cell, k) => {
        const [cx, cz] = parseKey(k);
        const { model, rot } = plan.variantAt(cx, cz);
        const tpl = kit[model] ?? kit["road-straight"];
        if (tpl) {
          const tile = tpl.clone(true);
          tile.scale.setScalar(TILE);
          tile.position.set(cx * TILE, 0.012, cz * TILE);
          tile.rotation.y = (rot * Math.PI) / 2;
          tile.traverse((n) => {
            const m = n as THREE.Mesh;
            if (m.isMesh) m.receiveShadow = true;
          });
          roadsGroup.add(tile);
        }
        if (cell.light) {
          const off = TILE / 2 - 0.6;
          ([
            ["x", -off, -off],
            ["z", off, off],
          ] as const).forEach(([axis, ox, oz]) => {
            const l = makeTrafficLight(axis);
            l.position.set(cx * TILE + ox, 0, cz * TILE + oz);
            l.rotation.y = Math.atan2(-ox, -oz);
            setShadow(l);
            propsGroup.add(l);
          });
        }
        if (cell.lamp) {
          const lx = cx * TILE - TILE / 2 + 0.7;
          const lz = cz * TILE + TILE / 2 - 0.7;
          const tplL = kit["light-square"];
          if (tplL) {
            const lamp = tplL.clone(true);
            lamp.scale.setScalar(6);
            lamp.position.set(lx, 0, lz);
            setShadow(lamp);
            propsGroup.add(lamp);
          }
          /* Ampoule et vraie source lumineuse : la route reçoit la lumière. */
          const bulbMat = new THREE.MeshStandardMaterial({
            color: 0xffe7a3,
            emissive: 0xffc65c,
            emissiveIntensity: 0.15,
          });
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), bulbMat);
          bulb.position.set(lx, 3.65, lz);
          propsGroup.add(bulb);
          const light = new THREE.PointLight(0xffd27a, 0, 24, 1.55);
          light.position.set(lx, 3.55, lz);
          propsGroup.add(light);
          streetLampLights.push(light);
        }
      });
      neighborhoodRef.current.roads = plan.cells.size;
      setPlanStats((prev) => ({ ...prev, roads: plan.cells.size }));
      pedestrianRef.current?.refresh();
    };

    let ti = 0;
    const spawnNetCar = (cx: number, cz: number) => {
      const car = kitCar(ti).clone(true);
      setShadow(car);
      scene.add(car);
      const exits = plan.exitsAt(cx, cz);
      const dirOut = (exits[0] ?? 0) as Dir;
      netCars.push({
        car,
        wheels: findWheels(car),
        speed: 3.4 + (ti % 3) * 0.5,
        baseY: 0,
        yaw: 0,
        cx,
        cz,
        dirIn: dirOut,
        dirOut,
        t: Math.random() * 0.5,
      });
      ti++;
    };

    /* ----- Itinéraire routier complet : route → parcelle → tunnel → retour ----- */
    const CITY_SOUTH = MAIN_CZ_START * TILE; // départ sur la route principale
    const SITE_ROAD_Z = WASH_SITE_Z + 13; // rue est-ouest de la parcelle
    const WASH_IN_X = PATH_START;
    const WASH_OUT_X = PATH_END;
    const ROUTE: Array<[number, number]> = [
      [WASH_ACCESS_X - 1.25, CITY_SOUTH],
      [WASH_ACCESS_X - 1.25, SITE_ROAD_Z - 1.25],
      [WASH_IN_X, SITE_ROAD_Z - 1.25],
      [WASH_IN_X, WASH_SITE_Z],
      [WASH_OUT_X, WASH_SITE_Z],
      [WASH_OUT_X, SITE_ROAD_Z + 1.25],
      [WASH_ACCESS_X + 1.25, SITE_ROAD_Z + 1.25],
      [WASH_ACCESS_X + 1.25, CITY_SOUTH],
    ];
    const ROUTE_CUM: number[] = [0];
    for (let i = 1; i < ROUTE.length; i++) {
      const a = ROUTE[i - 1]!;
      const b = ROUTE[i]!;
      ROUTE_CUM.push(ROUTE_CUM[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
    }
    const ROUTE_LEN = ROUTE_CUM[ROUTE_CUM.length - 1]!;
    // portion de l'itinéraire correspondant à la zone de lavage
    const WASH_D0 = ROUTE_CUM[3]! + (WASH_ZONE[0] - WASH_IN_X);
    const WASH_D1 = ROUTE_CUM[3]! + (WASH_ZONE[1] - WASH_IN_X);

    const posAt = (d: number) => {
      const dd = Math.min(Math.max(d, 0), ROUTE_LEN);
      let i = 1;
      while (i < ROUTE_CUM.length - 1 && ROUTE_CUM[i]! < dd) i++;
      const a = ROUTE[i - 1]!;
      const b = ROUTE[i]!;
      const segLen = ROUTE_CUM[i]! - ROUTE_CUM[i - 1]!;
      const k = segLen > 0 ? (dd - ROUTE_CUM[i - 1]!) / segLen : 0;
      const x = a[0] + (b[0] - a[0]) * k;
      const z = a[1] + (b[1] - a[1]) * k;
      const heading = Math.atan2(b[0] - a[0], b[1] - a[1]);
      return { x, z, heading };
    };

    /* Une voiture du réseau décide spontanément d'aller au lavage : celle qui
       est la plus proche de la parcelle quitte la circulation, suit
       l'itinéraire jusqu'au tunnel, puis repart rouler une fois propre. */
    let washCooldown = 6 + Math.random() * 6;
    const sendCityCarToWash = () => {
      if (netCars.length <= 2) return;
      const start = posAt(0);
      let best = -1;
      let bestD = Infinity;
      netCars.forEach((c, i) => {
        const d =
          (c.car.position.x - start.x) ** 2 + (c.car.position.z - start.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      if (best < 0) return;
      const origin = netCars.splice(best, 1)[0];
      if (!origin) return;
      origin.car.position.set(start.x, origin.baseY, start.z);
      tintCar(origin.car, 1);
      const soap = makeSoapCoat();
      origin.car.add(soap);
      washCars.push({
        car: origin.car,
        d: 0,
        speed: 5.2,
        yaw: origin.yaw,
        baseY: origin.baseY,
        wheels: origin.wheels,
        origin,
        soap,
      });

    };







    let cinemaMode = false;
    cinemaRef.current = () => {
      cinemaMode = !cinemaMode;
      controls.enabled = !cinemaMode;
      setCinema(cinemaMode);
    };

    const STREET_W = TILE; // largeur d'une chaussée = une tuile Kenney



    const buildScene = () => {
      buildLandscape();



      /* ----- Grand portique de lavage (structure bien visible) ----- */
      const hallMat = new THREE.MeshStandardMaterial({ color: 0xe9eef3, roughness: 0.75 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x1f6fb2, roughness: 0.6 });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x9ad4ee,
        roughness: 0.2,
        metalness: 0.1,
        transparent: true,
        opacity: 0.55,
      });
      const HALL_LEN = 15; // le long de x (sens de circulation)
      const HALL_W = 9.5; // le long de z
      const HALL_H = 5.2;
      const HALL_CX = 2;
      const hall = new THREE.Group();

      // Murs latéraux + bandeaux vitrés
      [-1, 1].forEach((s) => {
        const wall = new THREE.Mesh(
          new THREE.BoxGeometry(HALL_LEN, HALL_H, 0.4),
          hallMat,
        );
        wall.position.set(HALL_CX, HALL_H / 2, (s * HALL_W) / 2);
        wall.castShadow = true;
        wall.receiveShadow = true;
        hall.add(wall);

        const glass = new THREE.Mesh(
          new THREE.BoxGeometry(HALL_LEN - 2, 1.6, 0.12),
          glassMat,
        );
        glass.position.set(HALL_CX, 3.2, (s * (HALL_W + 0.5)) / 2);
        hall.add(glass);
      });

      // Toiture + acrotère coloré
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(HALL_LEN + 1.4, 0.5, HALL_W + 1.4),
        hallMat,
      );
      roof.position.set(HALL_CX, HALL_H + 0.25, 0);
      roof.castShadow = true;
      hall.add(roof);
      const band = new THREE.Mesh(
        new THREE.BoxGeometry(HALL_LEN + 1.6, 0.55, HALL_W + 1.6),
        trimMat,
      );
      band.position.set(HALL_CX, HALL_H + 0.75, 0);
      hall.add(band);

      // Portiques d'entrée et de sortie (arches marquées)
      [-1, 1].forEach((s) => {
        const arch = new THREE.Mesh(
          new THREE.BoxGeometry(0.6, 1.5, HALL_W + 1.8),
          trimMat,
        );
        arch.position.set(HALL_CX + (s * HALL_LEN) / 2, HALL_H - 0.4, 0);
        hall.add(arch);
        [-1, 1].forEach((z) => {
          const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.6, HALL_H, 0.8),
            trimMat,
          );
          post.position.set(
            HALL_CX + (s * HALL_LEN) / 2,
            HALL_H / 2,
            (z * (HALL_W + 1.8)) / 2,
          );
          post.castShadow = true;
          hall.add(post);
        });
      });

      // Totem d'enseigne "CAR WASH"
      const totemPost = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 6, 0.4),
        trimMat,
      );
      totemPost.position.set(HALL_CX - HALL_LEN / 2 - 3, 3, HALL_W / 2 + 2.5);
      totemPost.castShadow = true;
      hall.add(totemPost);
      const signCanvas = document.createElement("canvas");
      signCanvas.width = 512;
      signCanvas.height = 160;
      const sctx = signCanvas.getContext("2d")!;
      sctx.fillStyle = "#1f6fb2";
      sctx.fillRect(0, 0, 512, 160);
      sctx.fillStyle = "#ffffff";
      sctx.font = "bold 90px sans-serif";
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      sctx.fillText("CAR WASH", 256, 84);
      const signTex = new THREE.CanvasTexture(signCanvas);
      const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(6, 1.9, 0.25), signMat);
      sign.position.set(HALL_CX - HALL_LEN / 2 - 3, 6.4, HALL_W / 2 + 2.5);
      sign.castShadow = true;
      hall.add(sign);
      // Enseigne murale identique sur le long pan
      const wallSign = new THREE.Mesh(new THREE.BoxGeometry(8, 2.4, 0.2), signMat);
      wallSign.position.set(HALL_CX, HALL_H - 1.2, HALL_W / 2 + 0.3);
      hall.add(wallSign);

      washSite.add(hall);

      /* Pas de portique provisoire : seul le tunnel détaillé est ajouté une
         fois chargé, ce qui évite les résidus de l'ancien modèle. */





      // Tapis roulant
      const conveyor = makeConveyor();
      washSite.add(conveyor.group);
      conveyorSlats.push(...conveyor.slats);

      /* Rouleaux verticaux : deux paires à l'entrée (bien visibles depuis
         l'extérieur) et deux paires à l'intérieur du portique. */
      [-1, 1].forEach((zSide, si) => {
        [-1.1, 1.2, 3.4].forEach((offset, oi) => {
          const pivot = new THREE.Group();
          const spin = makeBrush();
          spin.scale.set(1.7, 1.7, 1.7);
          pivot.add(spin);
          pivot.position.set(WASH_ZONE[0] + offset, ROAD_Y + 1.4, zSide * 1.9);
          washSite.add(pivot);

          brushes.push({
            pivot,
            spin,
            dir: (si + oi) % 2 === 0 ? 1 : -1,
            kind: "roller",
          });
        });
      });

      // Brosses horizontales au-dessus du tapis (elles descendent sur la voiture)
      [-0.4, 2.2, 4.6].forEach((x, i) => {
        const pivot = new THREE.Group();
        pivot.rotation.x = Math.PI / 2;
        const spin = makeBrush();
        spin.scale.set(1.5, 2.1, 1.5);
        pivot.add(spin);
        pivot.position.set(x, ROAD_Y + 2.4, 0);
        washSite.add(pivot);
        brushes.push({ pivot, spin, dir: i % 2 === 0 ? -1 : 1, kind: "brush" });
      });


      /* Rampes de gicleurs : arche d'eau à l'entrée, rinçage à la sortie. */
      [-1.4, 1.4, 4.2].forEach((x) => {
        [-1.5, 0, 1.5].forEach((z) => {
          const jet = makeWaterJet();
          jet.group.position.set(x, ROAD_Y + 3.1, z);
          washSite.add(jet.group);
          waterJets.push(jet);
        });
      });

      for (let i = 0; i < 2; i++) {
        const foam = makeFoamVeil();
        foam.position.set(1.5 + i * 2, ROAD_Y + 1.2, 0);
        washSite.add(foam);
        foamSprites.push(foam);
      }



      // ----- Sols et matériaux partagés -----
      const asphalt = new THREE.MeshStandardMaterial({
        color: 0x4a4f57,
        roughness: 0.95,
      });
      const sidewalkMat = new THREE.MeshStandardMaterial({
        color: 0xd6d2c4,
        roughness: 1,
      });
      const dashMat = new THREE.MeshStandardMaterial({
        color: 0xf5f0d8,
        roughness: 0.7,
      });
      const lawnMat = new THREE.MeshStandardMaterial({ color: 0x7fc76b, roughness: 1 });
      const dashGeoX = new THREE.PlaneGeometry(1.4, 0.16);
      const zMin = MAIN_CZ_START * TILE; // extrémité sud de la route principale

      const addSlab = (
        mat: THREE.Material,
        w: number,
        d: number,
        x: number,
        z: number,
        y: number,
      ) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, y, z);
        m.receiveShadow = true;
        scene.add(m);
        return m;
      };

      /* ----- Route principale : du car wash vers les reliefs du fond -----
         Elle est posée par le jeu et ne peut pas être effacée ; tout le reste
         du réseau est construit par le joueur. */
      for (let cz = MAIN_CZ_START; cz <= MAIN_CZ_END; cz++) {
        plan.place(MAIN_CX, cz, "straight", 0, true);
      }
      renderPlan();





      /* ----- Parcelle dédiée du car wash (périphérie sud) ----- */
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x9aa0a6,
        roughness: 1,
      });

      /* Voie d'accès : déjà pavée en tuiles Kenney ci-dessus, on ajoute
         seulement la bande enherbée de bord. */
      const accessLen = zMin - WASH_SITE_Z;
      const accessCz = (zMin + WASH_SITE_Z) / 2;
      addSlab(sidewalkMat, STREET_W + 2.4, accessLen, WASH_ACCESS_X, accessCz, 0.004);


      // Terrain de la station : pelouse + dalle béton (parcelle resserrée)
      addSlab(lawnMat, 38, 21, 0, WASH_SITE_Z + 2, 0.008);
      addSlab(concreteMat, 32, 16, 0, WASH_SITE_Z + 2.5, 0.012);

      // Voie de lavage (traversée est-ouest de la parcelle)
      addSlab(asphalt, 30, STREET_W, 0, WASH_SITE_Z, 0.02);
      for (let x = -14; x <= 14; x += 3) {
        if (x > PATH_START + 2 && x < PATH_END - 2) continue;
        const d = new THREE.Mesh(dashGeoX, dashMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.03, WASH_SITE_Z);
        scene.add(d);
      }


      /* Rue de desserte est-ouest de la parcelle + raccords vers la voie de
         lavage : les voitures suivent la route de bout en bout. */
      const siteRoadW = STREET_W;
      addSlab(sidewalkMat, 40, siteRoadW + 1.2, 0, SITE_ROAD_Z, 0.005);
      addSlab(asphalt, 40, siteRoadW, 0, SITE_ROAD_Z, 0.02);
      [WASH_IN_X, WASH_OUT_X].forEach((cx) => {
        const len = SITE_ROAD_Z - WASH_SITE_Z + siteRoadW;
        const cz = (SITE_ROAD_Z + WASH_SITE_Z) / 2;
        addSlab(sidewalkMat, siteRoadW + 1.2, len, cx, cz, 0.005);
        addSlab(asphalt, siteRoadW, len, cx, cz, 0.021);
      });


      // Parking : places marquées, voitures bien rangées dans les cases
      const parkZ = WASH_SITE_Z + 8;
      addSlab(concreteMat, 24, 7.5, -2, parkZ, 0.016);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ec, roughness: 0.8 });
      for (let i = 0; i <= 5; i++) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 6), lineMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(-12 + i * 4.4, 0.024, parkZ);
        scene.add(line);
      }
      // Voitures Kenney en attente, alignées au centre de leur place
      [0, 1, 2, 3].forEach((i) => {
        const parked = kitCar(i * 2 + 4).clone(true);
        setShadow(parked);
        parked.rotation.y = Math.PI / 2;
        parked.position.set(-12 + 2.2 + i * 4.4, 0, parkZ);
        scene.add(parked);
      });

      /* Arbres de la parcelle : uniquement sur la pelouse, jamais sur la
         chaussée (voie de lavage, rue de desserte, raccords, accès ville). */
      const onSiteRoad = (x: number, z: number) => {
        const halfW = STREET_W / 2 + 1.2;
        if (Math.abs(z - WASH_SITE_Z) <= halfW) return true; // voie de lavage
        if (Math.abs(z - SITE_ROAD_Z) <= halfW) return true; // rue de desserte
        const inLink = z >= WASH_SITE_Z - halfW && z <= SITE_ROAD_Z + halfW;
        if (inLink && (Math.abs(x - WASH_IN_X) <= halfW || Math.abs(x - WASH_OUT_X) <= halfW))
          return true;
        if (z >= WASH_SITE_Z && Math.abs(x - WASH_ACCESS_X) <= halfW) return true;
        return false;
      };
      const plantSiteTree = (x: number, z: number) => {
        if (onSiteRoad(x, z)) return;
        const tr = makeTree();
        tr.position.set(x, 0, z);
        tr.scale.setScalar(0.9);
        setShadow(tr);
        scene.add(tr);
      };
      // bande enherbée au nord de la voie de lavage
      for (let x = -17; x <= 17; x += 4.5) plantSiteTree(x, WASH_SITE_Z - 6.8);
      // bordures est / ouest de la parcelle
      for (let z = WASH_SITE_Z - 7; z <= SITE_ROAD_Z + 4; z += 4.5) {
        plantSiteTree(-18.5, z);
        plantSiteTree(18.5, z);
      }


      // ----- Trafic initial : quelques voitures sur la route principale -----
      for (let i = 0; i < 6; i++) {
        spawnNetCar(MAIN_CX, MAIN_CZ_START + 2 + i * 2);
      }
    };

    /* ---------- Mode construction : le joueur pose son réseau ---------- */
    const gridHelper = new THREE.GridHelper(TILE * 30, 30, 0x2b6cb0, 0x9ec5e8);
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.3;
    gridHelper.position.y = 0.04;
    gridHelper.visible = false;
    scene.add(gridHelper);

    const ghost = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE * 0.94, TILE * 0.94),
      new THREE.MeshBasicMaterial({ color: 0x2bd07c, transparent: true, opacity: 0.45 }),
    );
    ghost.rotation.x = -Math.PI / 2;
    ghost.position.y = 0.07;
    ghost.visible = false;
    scene.add(ghost);

    /* Aperçu 3D translucide de l'objet sélectionné : il suit le curseur et
       tourne en direct avec le bouton de rotation, avant la pose. */
    const previewGroup = new THREE.Group();
    previewGroup.visible = false;
    scene.add(previewGroup);
    let previewKey = "";
    const makeTranslucent = (obj: THREE.Object3D) => {
      obj.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mesh.material = mats.map((m) => {
          const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
          c.transparent = true;
          c.opacity = 0.55;
          c.depthWrite = false;
          return c;
        }) as unknown as THREE.Material;
        if (Array.isArray(mesh.material) && (mesh.material as THREE.Material[]).length === 1) {
          mesh.material = (mesh.material as THREE.Material[])[0]!;
        }
      });
    };
    /** Modèle d'aperçu pour l'outil courant (null si l'outil n'en a pas). */
    const buildPreview = () => {
      const tool = toolRef.current;
      const key =
        tool === "house"
          ? `house:${houseLevelRef.current}`
          : tool === "park" || tool === "parking"
            ? `decor:${decorKindRef.current}`
            : "";
      if (key === previewKey) return;
      previewKey = key;
      [...previewGroup.children].forEach((c) => previewGroup.remove(c));
      if (!key) return;
      const obj = key.startsWith("house")
        ? makeHouse(houseLevelRef.current)
        : makeDecor(decorKindRef.current, 7);
      makeTranslucent(obj);
      previewGroup.add(obj);
    };


    const BUILD_MIN_CZ = MAIN_CZ_START + 1;
    const BUILD_MAX_CZ = MAIN_CZ_END + 2;
    const BUILD_MAX_CX = 12;
    const canBuild = (cx: number, cz: number) =>
      Math.abs(cx) <= BUILD_MAX_CX &&
      cz >= BUILD_MIN_CZ &&
      cz <= BUILD_MAX_CZ &&
      !plan.get(cx, cz)?.locked;

    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitPoint = new THREE.Vector3();
    const cellUnderPointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(groundPlane, hitPoint)) return null;
      return { cx: worldToCell(hitPoint.x), cz: worldToCell(hitPoint.z) };
    };

    /** dernière case survolée : sert de socle à l'aperçu 3D (utile au tactile) */
    let lastCell = { cx: 0, cz: MAIN_CZ_START + 6 };
    let downAt: { x: number; y: number; id: number; type: string } | null = null;
    let roadDragLast: { cx: number; cz: number } | null = null;
    const isRoadTool = (t: BuildTool): t is RoadHint =>
      t === "straight" || t === "bend" || t === "intersection" || t === "crossroad";
    /** Tous les outils de pose principaux fonctionnent en maintenant le doigt/souris
        puis en glissant sur la grille. Le car wash reste un outil spécial. */
    const isDragTool = (t: BuildTool) =>
      isRoadTool(t) ||
      t === "bulldoze" ||
      t === "erase" ||
      t === "house" ||
      t === "park" ||
      t === "parking" ||
      t === "light" ||
      t === "lamp";

    /* Rendus à rafraîchir après une série d'actions. */
    const dirty = { plan: false, houses: false, decor: false };
    const flushRender = () => {
      if (dirty.plan) renderPlan();
      if (dirty.houses) renderHouses();
      if (dirty.decor) renderDecor();
      dirty.plan = dirty.houses = dirty.decor = false;
    };

    /** Gomme universelle : retire n'importe quel élément posé sur la case. */
    const eraseAt = (cx: number, cz: number) => {
      let done = false;
      if (plan.removeDecor(cx, cz)) {
        dirty.decor = true;
        done = true;
      }
      if (plan.removeHouse(cx, cz)) {
        dirty.houses = true;
        done = true;
      }
      if (done) return true;
      const cell = plan.get(cx, cz);
      if (cell && (cell.light || cell.lamp)) {
        cell.light = false;
        cell.lamp = false;
        dirty.plan = true;
        return true;
      }
      if (plan.removeForce(cx, cz)) {
        dirty.plan = true;
        return true;
      }
      return false;
    };

    /** Applique l'outil courant sur une case. Utilisé aussi pendant le glissement. */
    const applyAt = (cx: number, cz: number) => {
      const tool = toolRef.current;
      if (tool === "erase") return eraseAt(cx, cz);
      if (tool === "bulldoze") {
        let done = false;
        if (plan.removeDecor(cx, cz)) { dirty.decor = true; done = true; }
        if (plan.removeHouse(cx, cz)) { dirty.houses = true; done = true; }
        if (plan.removeForce(cx, cz)) { dirty.plan = true; done = true; }
        return done;
      }
      if (tool === "house") {
        if (!plan.canPlaceHouse(cx, cz)) return false;
        const lvl = houseLevelRef.current;
        if (!spendRef.current(houseDef(lvl).cost, "house", `Maison niveau ${lvl} construite`)) return false;
        plan.placeHouse(cx, cz, lvl, rotRef.current);
        dirty.houses = true;
        return true;
      }
      if (tool === "park" || tool === "parking") {
        if (!canBuild(cx, cz) || !plan.canPlaceDecor(cx, cz)) return false;
        const kind = decorKindRef.current;
        const def = decorDef(kind);
        if (!spendRef.current(def.cost, "decor", def.label)) return false;
        plan.placeDecor(cx, cz, kind, rotRef.current);
        dirty.decor = true;
        return true;
      }
      if (tool === "light" || tool === "lamp") {
        const cell = plan.get(cx, cz);
        if (!cell || cell[tool]) return false;
        plan.setProp(cx, cz, tool, true);
        dirty.plan = true;
        return true;
      }
      if (!isRoadTool(tool) || !canBuild(cx, cz)) return false;
      if (plan.decorAt(cx, cz) || plan.house(cx, cz)) return false;
      plan.place(cx, cz, tool, rotRef.current);
      dirty.plan = true;
      return true;
    };


    const traceRoadTo = (target: { cx: number; cz: number }) => {
      if (!roadDragLast) {
        applyAt(target.cx, target.cz);
        roadDragLast = { ...target };
        flushRender();
        return;
      }

      let cx = roadDragLast.cx;
      let cz = roadDragLast.cz;
      let guard = 0;
      const destructive = toolRef.current === "bulldoze" || toolRef.current === "erase";
      while ((cx !== target.cx || cz !== target.cz) && guard++ < 80) {
        const dx = target.cx - cx;
        const dz = target.cz - cz;
        // On avance case par case : le changement d'axe crée le virage automatiquement.
        if (Math.abs(dx) >= Math.abs(dz) && dx !== 0) cx += Math.sign(dx);
        else if (dz !== 0) cz += Math.sign(dz);

        roadDragLast = { cx, cz };
        if (!destructive && isRoadTool(toolRef.current) && !canBuild(cx, cz)) break;
        applyAt(cx, cz);
      }
      flushRender();
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (!buildRef.current || buildCameraRef.current) {
        ghost.visible = false;
        return;
      }
      const c = cellUnderPointer(ev);
      if (!c) {
        ghost.visible = false;
        return;
      }
      lastCell = { ...c };
      ghost.visible = true;
      ghost.position.set(c.cx * TILE, 0.07, c.cz * TILE);
      const existing = plan.get(c.cx, c.cz);
      const occupied =
        !!existing || !!plan.house(c.cx, c.cz) || !!plan.decorAt(c.cx, c.cz);
      const tool = toolRef.current;
      const destructive = tool === "bulldoze" || tool === "erase";
      const ok =
        tool === "bulldoze"
          ? !!existing
          : tool === "erase"
            ? occupied
            : tool === "light" || tool === "lamp"
              ? !!existing
              : tool === "house"
                ? plan.canPlaceHouse(c.cx, c.cz) || !!plan.house(c.cx, c.cz)
                : tool === "park" || tool === "parking"
                  ? canBuild(c.cx, c.cz) && plan.canPlaceDecor(c.cx, c.cz)
                  : tool === "wash"
                    ? false
                    : canBuild(c.cx, c.cz) && !occupied;
      (ghost.material as THREE.MeshBasicMaterial).color.set(
        destructive ? (ok ? 0xe05252 : 0x9aa5ad) : ok ? 0x2bd07c : 0xe05252,
      );
      if (downAt?.id === ev.pointerId && isDragTool(toolRef.current)) {
        ev.preventDefault();
        traceRoadTo(c);
      }
    };

    const releasePointer = (ev: PointerEvent) => {
      try {
        if (renderer.domElement.hasPointerCapture(ev.pointerId)) {
          renderer.domElement.releasePointerCapture(ev.pointerId);
        }
      } catch {
        // Le pointeur peut déjà avoir été relâché par le navigateur.
      }
    };
    const onPointerDown = (ev: PointerEvent) => {
      if (!buildRef.current || buildCameraRef.current) return;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      ev.preventDefault();
      downAt = {
        x: ev.clientX,
        y: ev.clientY,
        id: ev.pointerId,
        type: ev.pointerType,
      };
      try {
        renderer.domElement.setPointerCapture(ev.pointerId);
      } catch {
        // Certains WebView ne prennent pas en charge la capture de pointeur.
      }
      roadDragLast = null;
      onPointerMove(ev);
    };
    const onPointerUp = (ev: PointerEvent) => {
      const start = downAt;
      if (!start || start.id !== ev.pointerId) return;
      downAt = null;
      releasePointer(ev);
      if (!buildRef.current) return;
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      const tool = toolRef.current;
      const c = cellUnderPointer(ev);
      if (isDragTool(tool)) {
        if (c) traceRoadTo(c);
        roadDragLast = null;
        flushRender();
        return;
      }
      if (tool === "wash") return;

      const tapTolerance = start.type === "touch" || start.type === "pen" ? 24 : 8;
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > tapTolerance) return;
      if (!c) return;
      if (tool === "park" || tool === "parking") {
        const kind = decorKindRef.current;
        const def = decorDef(kind);
        const existingDecor = plan.decorAt(c.cx, c.cz);
        if (existingDecor) {
          // reclic sur un décor : rotation d'un quart de tour
          plan.placeDecor(c.cx, c.cz, existingDecor.kind, (existingDecor.rot + 1) % 4);
          renderDecor();
          return;
        }
        if (!canBuild(c.cx, c.cz) || !plan.canPlaceDecor(c.cx, c.cz)) return;
        if (!spendRef.current(def.cost, "decor", def.label)) return;
        plan.placeDecor(c.cx, c.cz, kind, rotRef.current);
        renderDecor();
        return;
      }
      if (tool === "house") {
        const existingHouse = plan.house(c.cx, c.cz);
        if (existingHouse) {
          // clic sur une maison existante : amélioration de niveau
          const target = Math.min(MAX_HOUSE_LEVEL, existingHouse.level + 1);
          if (target === existingHouse.level) return;
          if (!spendRef.current(houseDef(target).cost, "house", `Maison améliorée niveau ${target}`)) return;
          plan.placeHouse(c.cx, c.cz, target, existingHouse.rot ?? 0);
          renderHouses();
          return;
        }
        if (!plan.canPlaceHouse(c.cx, c.cz)) return;
        const lvl = houseLevelRef.current;
        if (!spendRef.current(houseDef(lvl).cost, "house", `Maison niveau ${lvl} construite`)) return;
        plan.placeHouse(c.cx, c.cz, lvl, rotRef.current);
        renderHouses();
        return;
      }
      if (tool === "light" || tool === "lamp") {
        const cell = plan.get(c.cx, c.cz);
        if (!cell) return;
        plan.setProp(c.cx, c.cz, tool, !cell[tool]);
        renderPlan();
        return;
      }
      if (!canBuild(c.cx, c.cz)) return;
      if (plan.decorAt(c.cx, c.cz) || plan.house(c.cx, c.cz)) return;
      plan.place(c.cx, c.cz, tool, rotRef.current);
      renderPlan();
    };
    const onPointerCancel = (ev: PointerEvent) => {
      if (downAt?.id === ev.pointerId) downAt = null;
      roadDragLast = null;
      releasePointer(ev);
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerCancel);

    buildApplyRef.current = (on: boolean) => {
      gridHelper.visible = on;
      controls.enabled = !on || buildCameraRef.current;
      renderer.domElement.style.touchAction = on ? "none" : "auto";
      if (!on) {
        ghost.visible = false;
        downAt = null;
        roadDragLast = null;
      }
    };
    buildCameraApplyRef.current = (cameraMode: boolean) => {
      if (!buildRef.current) {
        controls.enabled = !walkingRef.current;
        return;
      }
      controls.enabled = cameraMode;
      ghost.visible = false;
      downAt = null;
      roadDragLast = null;
      renderer.domElement.style.touchAction = "none";
    };
    planIoRef.current = {
      save: () => plan.serialize(),
      load: (data) => {
        plan.load(data);
        renderPlan();
      },
      saveHouses: () => plan.serializeHouses(),
      loadHouses: (data) => {
        plan.loadHouses(data);
        renderHouses();
      },
      saveDecor: () => plan.serializeDecor(),
      loadDecor: (data) => {
        plan.loadDecor(data);
        renderDecor();
      },
    };





    const clock = new THREE.Clock();
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;

      /* Cycle complet en 3 minutes réelles. Le jeu démarre le matin. */
      const DAY_SECONDS = 180;
      const dayPhase = (t / DAY_SECONDS + 0.35) % 1;
      const sunAngle = (dayPhase - 0.25) * Math.PI * 2;
      const sunWave = Math.sin(sunAngle);
      const daylight = THREE.MathUtils.clamp((sunWave + 0.12) / 0.72, 0, 1);
      const night = 1 - daylight;
      sun.intensity = daylight * 1.6;
      sun.position.set(Math.cos(sunAngle) * 70, Math.max(Math.sin(sunAngle) * 80, -20), 24);
      moon.intensity = night * 0.72;
      moon.position.set(-sun.position.x, Math.max(-sun.position.y, 18), -24);
      hemi.intensity = 0.26 + daylight * 0.72;
      skyMat.color.copy(nightSkyTint).lerp(daySkyTint, daylight);
      scene.fog?.color.copy(nightFog).lerp(dayFog, daylight);

      streetLampLights.forEach((light) => {
        light.intensity = night * 8.5;
      });
      houseLights.forEach((light) => {
        light.intensity = night * 4.2;
        light.parent?.traverse((n) => {
          const mesh = n as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            const m = mat as THREE.MeshStandardMaterial;
            if (m.userData?.['nightWindow']) m.emissiveIntensity = 0.08 + night * 1.5;
          });
        });
      });
      washLights.forEach((light) => {
        light.intensity = night * 7.5;
      });

      const hourFloat = dayPhase * 24;
      const hour = Math.floor(hourFloat);
      const minute = Math.floor((hourFloat - hour) * 60);
      const clockText = `${night > 0.55 ? "🌙" : "☀️"} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
      if (gameTimeRef.current) gameTimeRef.current.textContent = clockText;
      if (gameTimeBuildRef.current) gameTimeBuildRef.current.textContent = clockText;

      // aperçu 3D de l'objet à poser : suit la case visée et la rotation choisie
      if (buildRef.current) {
        buildPreview();
        const show = previewGroup.children.length > 0;
        previewGroup.visible = show;
        if (show) {
          previewGroup.position.set(lastCell.cx * TILE, 0, lastCell.cz * TILE);
          previewGroup.rotation.y = (rotRef.current * Math.PI) / 2;
        }
      } else if (previewGroup.visible) {
        previewGroup.visible = false;
      }

      // léger clapotis sur les surfaces d'eau
      if (waterSurface) waterSurface.position.y = 0.05 + Math.sin(t * 0.8) * 0.03;
      


      const ctl = machinesRef.current;
      const up = upgradesRef.current;
      const beltBoost = effectiveBeltFactor(up, clientBehaviorRef.current);
      const SPEED = 2.6;
      /* même tapis à l'arrêt, la voiture avance lentement pour ne jamais
         rester bloquée dans le portique */
      const BELT_SPEED = (ctl.belt ? 1.1 : 0.45) * beltBoost;
      const GAP = 3.2;
      const [zoneStart, zoneEnd] = WASH_ZONE;

      // Les voitures suivent l'itinéraire routier ; la première est en tête
      let aheadD = Number.POSITIVE_INFINITY;

      for (let i = 0; i < washCars.length; i++) {
        const e = washCars[i]!;
        const onBelt = e.d >= WASH_D0 && e.d <= WASH_D1;
        const wantSpeed = onBelt ? BELT_SPEED : e.speed;

        // Limite : garder une distance de sécurité avec la voiture devant
        let limit = aheadD - GAP;
        /* Portail d'entrée : on n'attend que si une AUTRE voiture (devant)
           occupe encore le tunnel. */
        if (!onBelt && e.d < WASH_D0 && aheadD < WASH_D1) {
          limit = Math.min(limit, WASH_D0 - 0.6);
        }


        const target = Math.min(e.d + dt * wantSpeed, limit);
        const moved = Math.max(target - e.d, 0);
        e.d += moved;

        /* Lavage terminé : la voiture sort du tunnel et paye la prestation. */
        if (!e.paid && e.d >= WASH_D1) {
          e.paid = true;
          const r = computeReward(up);
          const adjustedAmount = Math.max(1, Math.round(r.amount * rollerQualityFactor(rollerConditionRef.current) * clientBehaviorRef.current.payment / 100));
          registerWashRef.current(adjustedAmount, r.premium, effectiveWashDuration(up, clientBehaviorRef.current));
        }

        e.wheels.forEach((w) => {
          w.rotation.x -= ((w.userData['spinSign'] as number) ?? 1) * (moved / 0.35) * 2;
        });

        let dirtiness: number;
        if (e.d <= WASH_D0) dirtiness = 1;
        else if (e.d >= WASH_D1) dirtiness = 0;
        else dirtiness = 1 - (e.d - WASH_D0) / (WASH_D1 - WASH_D0);
        tintCar(e.car, dirtiness);

        /* Mousse : elle se dépose sur la première moitié du tunnel puis
           est rincée sur la seconde. */
        if (e.soap) {
          /* La mousse n'apparait que dans la zone savon. Elle reste légère et
             ne masque jamais entièrement le modèle Kenney. */
          const washSpan = WASH_D1 - WASH_D0;
          const soapStart = WASH_D0 + washSpan * 0.12;
          const soapEnd = WASH_D0 + washSpan * 0.62;
          const inSoapZone = e.d > soapStart && e.d < soapEnd;
          const soapProg = THREE.MathUtils.clamp((e.d - soapStart) / Math.max(soapEnd - soapStart, 0.001), 0, 1);
          const cover = inSoapZone ? Math.sin(Math.PI * soapProg) * 0.62 : 0;
          e.soap.visible = inSoapZone && cover > 0.025;
          e.soap.children.forEach((b, j) => {
            const s = (b.userData['s'] as number) ?? 1;
            b.scale.setScalar(Math.max(cover * s * (0.72 + Math.sin(t * 5 + j) * 0.08), 0.001));
            b.rotation.y += dt * 1.2;
          });
        }


        const p = posAt(e.d);
        e.car.position.set(
          p.x,
          onBelt ? e.baseY + 0.14 + Math.sin(t * 30) * 0.012 : e.baseY,
          p.z,
        );
        // rotation douce vers la direction de la route (virages)
        const targetRot = p.heading + e.yaw;
        let delta = targetRot - e.car.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        e.car.rotation.y += delta * Math.min(dt * 8, 1);

        aheadD = e.d;
      }

      /* Fin de l'itinéraire : la voiture, propre, reprend la route principale */
      for (let i = washCars.length - 1; i >= 0; i--) {
        const e = washCars[i]!;
        if (e.d >= ROUTE_LEN - 0.05) {
          const o = e.origin;
          tintCar(o.car, 0);
          if (e.soap) {
            o.car.remove(e.soap);
            e.soap.clear();
          }
          o.cx = MAIN_CX;
          o.cz = MAIN_CZ_START;
          o.dirIn = 0;
          o.dirOut = 0; // repart vers le nord
          o.t = 0.1;
          netCars.push(o);
          washCars.splice(i, 1);
        }

      }



      /* De temps en temps, une voiture de la ville part au lavage. */
      washCooldown -= dt;
      if (washCooldown <= 0) {
        neighborhoodRef.current.residents = residentsRef.current;
        const [lo, hi] = effectiveArrivalInterval(
          up,
          neighborhoodRef.current,
          clientBehaviorRef.current,
          districtDemandFactor(districtLevelRef.current),
        );
        washCooldown = (lo + Math.random() * (hi - lo)) / eventTrafficFactor(activeUrbanEventRef.current);
        if (ctl.traffic && washCars.length < queueCapacity(up)) sendCityCarToWash();
      }

      const carInWash = washCars.some((c) => c.d > WASH_D0 && c.d < WASH_D1);


      /* Rouleaux et brosses : rotation continue, accélérée au passage d'une
         voiture ; ils se resserrent et descendent sur la carrosserie. */
      const brushSpeed = carInWash ? 11 : 2.5;
      brushes.forEach((b, i) => {
        const on = b.kind === "roller" ? ctl.rollers : ctl.brushes;
        if (on) b.spin.rotation.y += dt * brushSpeed * b.dir;
        const engage = carInWash ? 1 : 0;
        const wobble = carInWash ? Math.sin(t * 6 + i) * 0.06 : 0;

        /* Lanières : elles s'écartent avec la vitesse de rotation et
           battent contre la carrosserie quand une voiture passe. */
        const flaps = b.spin.userData['flaps'] as THREE.Group | undefined;
        if (flaps) {
          const fly = (on ? 1 : 0) * (carInWash ? 0.95 : 0.4);
          flaps.children.forEach((f, k) => {
            const beat = Math.sin(t * (on ? 9 : 2) + k * 0.7) * 0.18 * (0.4 + fly);
            f.rotation.z = 0.35 + fly * 0.75 + beat;
          });
        }

        if (b.kind === "roller") {
          const side = Math.sign(b.pivot.position.z) || 1;
          const target = side * (1.45 - engage * 0.32 + wobble);
          b.pivot.position.z += (target - b.pivot.position.z) * Math.min(dt * 4, 1);
        } else {
          const target = ROAD_Y + 2.1 - engage * 0.42 + wobble;
          b.pivot.position.y += (target - b.pivot.position.y) * Math.min(dt * 4, 1);
        }
      });


      // Tapis roulant : les lattes défilent en boucle
      const beltLen = zoneEnd - zoneStart;
      if (ctl.belt) {
        conveyorSlats.forEach((s) => {
          s.position.x += dt * BELT_SPEED;
          if (s.position.x > zoneEnd) s.position.x -= beltLen;
        });
      }

      /* Circulation sur le réseau construit par le joueur : chaque voiture
         traverse une case, choisit une sortie au carrefour et s'arrête aux
         feux posés par le joueur. */
      const LIGHT_CYCLE = 9; // secondes par phase
      const phase = Math.floor(t / LIGHT_CYCLE) % 2;
      const greenAxis: "x" | "z" = phase === 0 ? "x" : "z";

      netCars.forEach((e) => {
        if (!ctl.traffic) return;
        const step = dt * e.speed;
        const nt = e.t + step / TILE;

        // distance de sécurité avec la voiture devant, dans la même case
        const tooClose = netCars.some(
          (o) =>
            o !== e && o.cx === e.cx && o.cz === e.cz && o.t > e.t && o.t - e.t < 0.4,
        );
        if (tooClose) return;

        if (nt < 1) {
          e.t = nt;
        } else {
          const [dx, dz] = DIR_VEC[e.dirOut]!;
          const nx = e.cx + dx;
          const nz = e.cz + dz;
          const next = plan.get(nx, nz);
          if (!next) {
            // cul-de-sac : demi-tour sans quitter la chaussée
            e.dirIn = e.dirOut;
            e.dirOut = opposite(e.dirIn);
            e.t = 0;
          } else {
            const busy =
              netCars.filter((o) => o !== e && o.cx === nx && o.cz === nz).length >= 2;
            const red = next.light && axisOf(e.dirOut) !== greenAxis;
            if (busy || red) {
              e.t = 0.97;
              return;
            }
            e.cx = nx;
            e.cz = nz;
            e.dirIn = e.dirOut;
            e.t = Math.min(nt - 1, 0.5);
            const exits = plan.exitsFrom(nx, nz, e.dirIn);
            e.dirOut =
              exits.includes(e.dirIn) && Math.random() < 0.65
                ? e.dirIn
                : exits[Math.floor(Math.random() * exits.length)]!;
          }
        }

        e.wheels.forEach((w) => {
          w.rotation.x -= ((w.userData['spinSign'] as number) ?? 1) * (step / 0.35) * 2;
        });
      });

      netCars.forEach((e) => {
        const p = netPose(e);
        e.car.position.set(p.x, e.baseY, p.z);
        let delta = p.heading + e.yaw - e.car.rotation.y;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        e.car.rotation.y += delta * Math.min(dt * 8, 1);
      });

      // Feux : vert sur l'axe qui passe, rouge sur l'autre
      trafficLights.forEach((l) => {
        const green = ctl.traffic && l.axis === greenAxis;
        (l.green.material as THREE.MeshStandardMaterial).emissiveIntensity = green ? 1.4 : 0.06;
        (l.red.material as THREE.MeshStandardMaterial).emissiveIntensity = green ? 0.06 : 1.4;
      });






      foamSprites.forEach((f) => {
        f.children.forEach((s, j) => {
          s.position.y += Math.sin(t * 4 + j) * 0.001;
        });
        f.visible = carInWash;
      });

      /* Gicleurs : nappe d'eau + gouttelettes qui retombent sur la voiture. */
      const jetsOn = carInWash && ctl.belt;
      waterJets.forEach((j, ji) => {
        j.group.visible = jetsOn;
        if (!jetsOn) return;
        const pulse = 0.8 + Math.sin(t * 8 + ji) * 0.2;
        j.cone.scale.set(pulse, 1, pulse);
        (j.cone.material as THREE.MeshStandardMaterial).opacity = 0.22 + pulse * 0.14;
        j.drops.forEach((d) => {
          let dt0 = ((d.userData['t'] as number) ?? 0) + dt * 1.5;
          if (dt0 > 1) dt0 -= 1;
          d.userData['t'] = dt0;
          const fall = dt0 * 2.7;
          d.position.set(
            (d.userData['ox'] as number) * (1 + dt0),
            -0.2 - fall,
            (d.userData['oz'] as number) * (1 + dt0),
          );
          d.scale.setScalar(1 - dt0 * 0.5);
        });
      });



      if (cinemaMode) {
        const angle = t * 0.18;
        camera.position.set(
          Math.cos(angle) * 20,
          11 + Math.sin(t * 0.3) * 2,
          Math.sin(angle) * 20 + 2 + WASH_SITE_Z,
        );
        camera.lookAt(2, 2, WASH_SITE_Z);
      }

      playerControllerRef.current?.update(dt, camera);
      interactionScan -= dt;
      if (interactionScan <= 0) {
        interactionScan = 0.18;
        const controller = playerControllerRef.current;
        const next = walkingRef.current && controller
          ? findNearbyInteraction(controller.root.position, plan, {
              washes: economyRef.current.washes,
              money: economyRef.current.money,
              machinesRunning: Object.values(machinesRef.current).every(Boolean),
              rollerCondition: rollerConditionRef.current,
              rollerLevel: upgradesRef.current.speed,
            })
          : null;
        if (next?.id !== nearbyInteractionRef.current?.id || next?.dialogue !== nearbyInteractionRef.current?.dialogue) {
          nearbyInteractionRef.current = next;
          setNearbyInteraction(next);
        }
        const dialogue = activeDialogueRef.current;
        if (dialogue && (!next || next.id !== dialogue.id)) closeDialogue();
      }
      pedestrianRef.current?.update(dt, t, residentsRef.current, netCars.map((car) => car.car));
      freeCameraPanRef.current(dt);
      if (!walkingRef.current) controls.update();
      renderer.render(scene, camera);
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.fov = isPortrait() ? 50 : 45;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", onResize);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    const loadAll = async () => {
      const res = await fetch(modelsAsset.url);
      const data = (await res.json()) as Record<string, string>;
      await Promise.all(
        MODEL_KEYS.map(
          (k) =>
            new Promise<void>((resolve, reject) => {
              loader.parse(
                b64ToArrayBuffer(data[k]!),
                "",
                (gltf) => {
                  models[k] = gltf.scene;
                  resolve();
                },
                (err) => reject(err instanceof Error ? err : new Error(String(err))),
              );
            }),
        ),
      );

      // Pack Kenney (routes, voitures, bâtiments, mobilier) en un seul GLB
      const pack = await new Promise<THREE.Group>((resolve, reject) => {
        loader.load(
          kenneyPackAsset.url,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => reject(err instanceof Error ? err : new Error(String(err))),
        );
      });
      [...pack.children].forEach((child) => {
        child.removeFromParent();
        kit[child.name] = child;
      });

      const citizenAssets = [citizenMaleA, citizenMaleC, citizenFemaleA, citizenFemaleD];
      const citizens = await Promise.all(citizenAssets.map((asset) => new Promise<THREE.Group>((resolve, reject) => {
        loader.load(asset.url, (gltf) => resolve(gltf.scene), undefined, (err) => reject(err instanceof Error ? err : new Error(String(err))));
      })));
      citizenTemplates.push(...citizens);
    };


    const loadMeshy = async () => {
      const load = (url: string) =>
        new Promise<THREE.Group>((resolve, reject) => {
          loader.load(
            url,
            (gltf) => resolve(gltf.scene),
            undefined,
            (err) => reject(err instanceof Error ? err : new Error(String(err))),
          );
        });

      // Tunnel de lavage : le modèle Meshy détaillé remplace le portique Kenney
      await load(tunnelAsset.url)
        .then((raw) => {
          if (disposed) return;
          const meshyTunnel = normalizeModel(raw, 11);
          // On le contient sous la toiture du hall
          const tb = new THREE.Box3().setFromObject(meshyTunnel);
          const th = tb.max.y - tb.min.y;
          const maxH = 4.6;
          if (th > maxH) meshyTunnel.scale.multiplyScalar(maxH / th);
          meshyTunnel.position.set(2, 0, 0);
          setShadow(meshyTunnel);
          washSite.add(meshyTunnel);
          /* Purge défensive : tout reste d'un ancien portique éventuellement
             présent dans la station est retiré et libéré. */
          [...washSite.children].forEach((c) => {
            if (c === meshyTunnel) return;
            if (!c.userData['legacyTunnel']) return;
            washSite.remove(c);
            c.traverse((n) => {
              const m = n as THREE.Mesh;
              if (m.isMesh) m.geometry.dispose();
            });
          });

        })
        .catch((err: unknown) => console.error("tunnel Meshy", err));

    };



    loadAll()
      .then(() => {
        if (disposed) return;
        buildScene();
        const playerModel = citizenTemplates[0];
        if (playerModel) {
          playerControllerRef.current = createPlayerController(scene, playerModel);
          pedestrianRef.current = createPedestrianSystem(scene, plan, citizenTemplates.slice(1));
          STREET_VENDORS.forEach((vendor, index) => {
            const stall = new THREE.Group();
            stall.name = `street-vendor-${vendor.id}`;
            stall.position.set(vendor.x, 0, vendor.z);
            const counter = new THREE.Mesh(
              new THREE.BoxGeometry(2.4, 1, 0.8),
              new THREE.MeshStandardMaterial({ color: vendor.color, roughness: 0.75 }),
            );
            counter.position.y = 0.5;
            counter.castShadow = true;
            stall.add(counter);
            const canopy = new THREE.Mesh(
              new THREE.BoxGeometry(2.8, 0.16, 1.25),
              new THREE.MeshStandardMaterial({ color: index % 2 ? 0xf4f0dc : 0x2c6eaa, roughness: 0.65 }),
            );
            canopy.position.y = 2.45;
            canopy.castShadow = true;
            stall.add(canopy);
            [-0.95, 0.95].forEach((x) => {
              const post = new THREE.Mesh(
                new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8),
                new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 }),
              );
              post.position.set(x, 1.2, 0.35);
              stall.add(post);
            });
            [-0.6, 0, 0.6].forEach((x, partIndex) => {
              const part = new THREE.Mesh(
                partIndex === 1 ? new THREE.TorusGeometry(0.2, 0.07, 8, 16) : new THREE.CylinderGeometry(0.13, 0.13, 0.42, 12),
                new THREE.MeshStandardMaterial({ color: partIndex === 1 ? 0x30343b : 0xd8dde3, metalness: 0.7, roughness: 0.3 }),
              );
              part.rotation.z = Math.PI / 2;
              part.position.set(x, 1.14, -0.08);
              stall.add(part);
            });
            const vendorModel = citizenTemplates[(index + 1) % citizenTemplates.length]?.clone(true);
            if (vendorModel) {
              vendorModel.scale.setScalar(0.85);
              vendorModel.position.set(0, 0, 0.72);
              vendorModel.rotation.y = Math.PI;
              setShadow(vendorModel);
              stall.add(vendorModel);
            }
            scene.add(stall);
          });
        }
        /* Restauration de la sauvegarde locale une fois la ville prête. */
        restoreLocalRef.current();
        localReadyRef.current = true;
        stopAutoCityGrowth = installAutoCityGrowth({
          scene,
          plan,
          tile: TILE,
          mainCx: MAIN_CX,
          mainCzStart: MAIN_CZ_START,
          getMoney: () => economyRef.current.money,
          isDisposed: () => disposed,
          makeHouse,
          renderPlan,
          renderHouses,
          renderDecor,
          onStageStart: (stage) => {
            toast.info(`🏗️ ${stage.label}`, { description: "La ville lance un nouveau chantier." });
          },
          onStageComplete: (stage) => {
            logRef.current(makeEvent("build", `Croissance automatique · ${stage.label}`));
            persistNowRef.current();
          },
        });
        setLoading(false);
        animate();


        void loadMeshy();
      })
      .catch((err: unknown) => {
        console.error(err);
        setMessage("Oups, un modèle n'a pas pu charger.");
      });


    return () => {
      disposed = true;
      cancelAnimationFrame(frame);

      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onFreeKeyDown);
      window.removeEventListener("keyup", onFreeKeyUp);
      freeCameraPanRef.current = () => {};
      controls.dispose();
      playerControllerRef.current?.dispose();
      playerControllerRef.current = null;
      pedestrianRef.current?.dispose();
      pedestrianRef.current = null;
      stopAutoCityGrowth?.();
      stopAutoCityGrowth = null;
      renderer.dispose();
      renderer.domElement.remove();
    };


  }, []);

  const pendingUpgradeDef = pendingUpgrade
    ? UPGRADES.find((upgrade) => upgrade.key === pendingUpgrade)
    : undefined;
  const pendingUpgradeLevel = pendingUpgrade ? upgrades[pendingUpgrade] : 0;
  const pendingUpgradeCost =
    pendingUpgrade && pendingUpgradeLevel < MAX_LEVEL
      ? upgradeCost(pendingUpgrade, pendingUpgradeLevel)
      : 0;
  const balanceAfterUpgrade = Math.max(0, economy.money - pendingUpgradeCost);
  const financeIncome = financePeriods.reduce((sum, period) => sum + period.income, 0);
  const financeExpenses = financePeriods.reduce((sum, period) => sum + period.expenses, 0);
  const currentFinancePeriod = financePeriods.at(-1);
  const previousFinancePeriod = financePeriods.at(-2);
  const currentProfit = (currentFinancePeriod?.income ?? 0) - (currentFinancePeriod?.expenses ?? 0);
  const previousProfit = (previousFinancePeriod?.income ?? 0) - (previousFinancePeriod?.expenses ?? 0);

  return (
    <>
      <div ref={wrapRef} className="fixed inset-0" />
      <RentalManager
        houses={planIoRef.current.saveHouses()}
        balance={economy.money}
        onIncome={receiveRentalIncome}
        onSpend={spendRentalNeed}
      />
      <AlertDialog
        open={pendingUpgrade !== null}
        onOpenChange={(open) => {
          if (!open && !purchaseLockRef.current) setPendingUpgrade(null);
        }}
      >
        <AlertDialogContent className="w-[calc(100%-1.5rem)] max-w-md rounded-2xl border-ink/15 bg-white p-5 text-ink">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle className="flex items-center gap-2 text-lg font-extrabold">
              <span aria-hidden>{pendingUpgradeDef?.icon}</span>
              Confirmer l’amélioration
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-ink/70">
              Vérifie le coût et ton nouveau solde avant de valider.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {pendingUpgradeDef && pendingUpgrade ? (
            <div className="grid gap-3 text-sm">
              <div className="rounded-lg bg-splash/10 p-3 ring-1 ring-splash/20">
                <p className="font-extrabold">{pendingUpgradeDef.label}</p>
                <p className="mt-0.5 text-xs opacity-70">
                  Niveau {pendingUpgradeLevel} → niveau {pendingUpgradeLevel + 1}
                </p>
                <p className="mt-2 text-xs font-semibold">
                  {pendingUpgradeDef.effect(pendingUpgradeLevel + 1)}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2 tabular-nums">
                <div className="rounded-lg bg-ink/5 p-3">
                  <dt className="text-xs font-bold opacity-60">Coût</dt>
                  <dd className="mt-1 font-extrabold">
                    {pendingUpgradeCost.toLocaleString("fr-FR")} €
                  </dd>
                </div>
                <div className="rounded-lg bg-ink/5 p-3">
                  <dt className="text-xs font-bold opacity-60">Solde actuel</dt>
                  <dd className="mt-1 font-extrabold">{economy.money.toLocaleString("fr-FR")} €</dd>
                </div>
              </dl>
              <div className="flex items-center justify-between rounded-lg bg-sunny/25 p-3 font-extrabold">
                <span>Solde après achat</span>
                <span className="tabular-nums">{balanceAfterUpgrade.toLocaleString("fr-FR")} €</span>
              </div>
            </div>
          ) : null}

          <AlertDialogFooter className="gap-2 sm:space-x-0">
            <AlertDialogCancel disabled={purchasingUpgrade !== null}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={purchasingUpgrade !== null || economy.money < pendingUpgradeCost}
              onClick={(event) => {
                event.preventDefault();
                void confirmUpgrade();
              }}
              className="bg-splash text-splash-foreground"
            >
              {purchasingUpgrade ? "Achat en cours…" : "Confirmer l’achat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {!buildMode && (
        <CameraControlsHud
          active={freeCamera}
          onToggle={toggleFreeCamera}
          onZoom={(d) => cameraIoRef.current.zoom(d)}
          onReset={() => cameraIoRef.current.reset()}
          onFocusWash={() => cameraIoRef.current.focusWash()}
        />
      )}
      <GameDashboard
        hidden={buildMode}
        player={player ?? null}
        money={economy.money}
        washes={economy.washes}
        residents={residents}
        houses={city.houses}
        capacity={city.capacity}
        machines={machines}
        cinema={cinema}
        walking={walking}
        rollerCondition={rollerCondition}
        rollerLevel={upgrades.speed}
        rollerPartGrade={rollerPartGrade}
        savedAt={savedAt ? new Date(savedAt).toLocaleString("fr-FR") : null}
        demand={neighborhoodDemand({ houses: city.houses, residents, roads: planStats.roads, parking: planStats.parking })}
        travelers={travelerDemand({ houses: city.houses, residents, roads: planStats.roads, parking: planStats.parking })}
        districtLevel={districtLevel}
        districtSnapshot={districtSnapshot}
        carsPerHour={carsPerHour(
          upgrades,
          { houses: city.houses, residents, roads: planStats.roads, parking: planStats.parking },
          clientBehavior,
          districtDemandFactor(districtLevel),
        )}
        onDistrictUpgrade={upgradeDistrict}
        activeEvent={activeUrbanEvent ? { icon: URBAN_EVENT_META[activeUrbanEvent.kind].icon, title: activeUrbanEvent.title, remaining: `${Math.max(0, Math.ceil((activeUrbanEvent.endsAt - Date.now()) / 60_000))} min` } : null}
        onBuild={toggleBuild}
        onShop={() => setShopOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        onClients={() => {
          setShopOpen(false);
          setHistoryOpen(false);
          setClientsOpen(true);
        }}
        onCarWash={() => setStatsOpen(true)}
        onSave={handleManualSave}
        onLoad={handleManualLoad}
        onToggleMachine={toggleMachine}
        onCinema={() => cinemaRef.current()}
        onWalk={toggleWalking}
      />
      <ClientsMenu
        open={clientsOpen}
        behavior={clientBehavior}
        upgrades={upgrades}
        neighborhood={{ houses: city.houses, residents, roads: planStats.roads, parking: planStats.parking }}
        rollerQuality={rollerQualityFactor(rollerCondition)}
        onChange={updateClientBehavior}
        onClose={() => setClientsOpen(false)}
      />
      <CarWashStatsMenu
        open={statsOpen}
        metrics={washMetrics}
        upgrades={upgrades}
        behavior={clientBehavior}
        rollerCondition={rollerCondition}
        partGrade={rollerPartGrade}
        event={activeUrbanEvent}
        onClose={() => setStatsOpen(false)}
      />
      {walking && (
        <InteractionHud
          nearby={nearbyInteraction}
          dialogue={activeDialogue}
          machinesRunning={Object.values(machines).every(Boolean)}
          actionDisabled={activeDialogue?.kind === "vendor" && ((rollerCondition >= 100 && rollerPartGrade === activeDialogue.partGrade) || economy.money < (activeDialogue.price ?? 0))}
          onInteract={interactNearby}
          onAction={performDialogueAction}
          onClose={closeDialogue}
        />
      )}

      {!buildMode && progression && (
        <div className="pointer-events-none fixed left-2 top-[68px] z-40 w-[min(310px,calc(100vw-1rem))] rounded-2xl bg-white/90 px-3 py-2 text-slate-900 shadow-lg ring-1 ring-slate-900/10 backdrop-blur sm:left-4 sm:top-[76px]">
          <div className="flex items-center gap-2 text-[12px] font-black"><span>{progression.icon}</span><span className="truncate">{progression.title}</span><span className="ml-auto tabular-nums text-slate-500">{Math.round((progression.value / progression.target) * 100)}%</span></div>
          <progress className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full accent-emerald-500" value={progression.value} max={progression.target} />
          <p className="mt-1 text-[10px] font-semibold text-slate-600">{progression.description}</p>
        </div>
      )}

      {walking && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div className="absolute bottom-24 left-5 size-28 rounded-full bg-white/65 shadow-lg ring-1 ring-slate-900/15 backdrop-blur pointer-events-auto touch-none"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              const rect = event.currentTarget.getBoundingClientRect();
              playerControllerRef.current?.setTouch((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), (event.clientY - rect.top - rect.height / 2) / (rect.height / 2));
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const rect = event.currentTarget.getBoundingClientRect();
              playerControllerRef.current?.setTouch((event.clientX - rect.left - rect.width / 2) / (rect.width / 2), (event.clientY - rect.top - rect.height / 2) / (rect.height / 2));
            }}
            onPointerUp={(event) => { event.currentTarget.releasePointerCapture(event.pointerId); playerControllerRef.current?.setTouch(0, 0); }}
            onPointerCancel={() => playerControllerRef.current?.setTouch(0, 0)}
            aria-label="Joystick de déplacement"
          >
            <div className="absolute inset-[34px] rounded-full bg-emerald-500 shadow-md" />
          </div>
          {!nearbyInteraction && !activeDialogue && (
            <div className="absolute bottom-24 right-4 rounded-2xl bg-slate-950/70 px-3 py-2 text-[11px] font-bold text-white backdrop-blur">WASD / flèches<br/>ou joystick</div>
          )}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[linear-gradient(180deg,var(--sky-top),var(--sky-mid)_55%,var(--sky-bottom))] transition-opacity duration-500">
          <div className="size-16 animate-bounce rounded-full bg-[radial-gradient(circle_at_30%_30%,#ffffff,var(--sky-mid)_70%,var(--sky-top))] shadow-[0_0_0_8px_rgba(255,255,255,.5),0_0_30px_rgba(255,255,255,.8)]" />
          <span className="mt-5 text-sm font-semibold tracking-wide text-ink">{message}</span>
        </div>
      )}

      {/* Mode construction : barre d'infos minimale pour dégager la vue 3D */}
      {buildMode && (
        <div className="pointer-events-none fixed left-2 right-2 top-2 z-40 flex items-center gap-2 rounded-full bg-white/85 px-3 py-1.5 text-ink shadow-[0_4px_14px_rgba(6,58,94,0.14)] ring-1 ring-ink/10 backdrop-blur sm:left-4 sm:right-4 sm:top-4">
          <span className="text-[13px] font-extrabold tabular-nums">
            💰 {economy.money.toLocaleString("fr-FR")} €
          </span>
          <span className="text-[12.5px] font-semibold opacity-80">
            👥 {residents} · 🏠 {city.houses}
          </span>
          <span ref={gameTimeBuildRef} className="ml-auto whitespace-nowrap text-[12px] font-extrabold opacity-80">
            ☀️ 08:00
          </span>
          <span className="hidden truncate text-[12px] font-semibold opacity-70 sm:inline">
            Mode construction — {TOOL_LABEL[tool]}
          </span>
        </div>
      )}

      <div
        className={`hidden fixed left-2 top-2 z-40 max-w-[calc(100vw-146px)] rounded-2xl bg-white/90 ring-1 ring-ink/10 px-3 py-2 text-ink shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur sm:left-4 sm:top-4 sm:max-w-[230px] sm:px-3 sm:py-2 ${buildMode ? "hidden" : ""}`}
      >
        <div className="flex items-center gap-2">
          <p className="flex items-center gap-2 text-[17px] font-bold tracking-wide sm:text-[18px]">
            <span aria-hidden>🫧</span> TikowikoCity
          </p>
          <span ref={gameTimeRef} className="ml-auto whitespace-nowrap rounded-full bg-ink/5 px-2 py-1 text-[11px] font-extrabold">
            ☀️ 08:00
          </span>
        </div>

        {player && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-splash/15 px-2 py-1.5">
            <img
              src={avatarSrc(player.avatarId)}
              alt={`Avatar de ${player.name}`}
              loading="lazy"
              width={512}
              height={512}
              className="size-8 rounded-full bg-white object-contain ring-1 ring-ink/10 sm:size-9"
            />
            <span className="truncate text-[13px] font-bold sm:text-[14px]">{player.name}</span>
          </div>
        )}

        <div className="relative mt-2 flex items-center gap-2 rounded-xl bg-sunny/25 px-2 py-1.5 ring-1 ring-ink/10">
          <span aria-hidden className="text-[15px]">💰</span>
          <span className="text-[15px] font-extrabold tabular-nums sm:text-[17px]">
            {economy.money.toLocaleString("fr-FR")} €
          </span>
          <span className="ml-auto text-[11px] font-semibold opacity-70">
            {economy.washes} lavage{economy.washes > 1 ? "s" : ""}
          </span>
          {gain && (
            <span
              key={gain.id}
              className="absolute -top-3 right-1 animate-bounce text-[13px] font-extrabold text-splash"
            >
              +{gain.amount} €
            </span>
          )}
        </div>


        <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-splash/15 px-2 py-1.5 ring-1 ring-ink/10">
          <span aria-hidden className="text-[15px]">👥</span>
          <span className="text-[14px] font-extrabold tabular-nums sm:text-[15px]">
            {residents} habitant{residents > 1 ? "s" : ""}
          </span>
          <span className="ml-auto text-[11px] font-semibold opacity-70">
            {city.houses} 🏠 / {city.capacity} places
          </span>
        </div>

        {/* Boutique d'améliorations + historique */}
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setShopOpen((v) => !v)}
            aria-expanded={shopOpen}
            className="flex-1 rounded-full bg-sunny px-3 py-2 text-[12.5px] font-bold text-sunny-foreground shadow-[0_3px_0_var(--sunny-shadow)] transition-transform active:translate-y-0.5"
          >
            🛠️ Améliorations
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            aria-expanded={historyOpen}
            className="rounded-full bg-splash/20 px-3 py-2 text-[12.5px] font-bold text-ink ring-1 ring-ink/10 transition-transform active:translate-y-0.5"
          >
            🧾 Historique
          </button>
        </div>


        <p className="mt-1 hidden text-[12.5px] leading-relaxed opacity-80 sm:block">
          Glisse pour tourner la caméra, molette pour zoomer.
        </p>

      </div>



      <div
        className={`pointer-events-none fixed bottom-2 left-2 z-30 hidden max-w-[46vw] rounded-2xl bg-white/70 px-3 py-2 text-[11.5px] sm:bottom-4 sm:left-4 text-ink shadow-[0_6px_20px_rgba(6,58,94,0.14)] backdrop-blur ${buildMode ? "" : "sm:block"}`}
      >
        <p>🖱️ Glisser = tourner • Molette = zoomer • Clic droit = déplacer</p>
        
        <p className="mt-1 font-semibold opacity-90">© {new Date().getFullYear()} tikowikoFamily</p>

      </div>

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[92vh] w-full max-w-[460px] flex-col rounded-lg bg-white p-3 text-ink shadow-[0_12px_40px_rgba(6,58,94,0.35)]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
              <h2 className="truncate text-base font-extrabold">🧾 Journal de la ville</h2>
              <span className="ml-auto rounded-full bg-sunny/30 px-2 py-1 text-[13px] font-extrabold tabular-nums">
                {economy.money.toLocaleString("fr-FR")} €
              </span>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Fermer le journal"
                className="rounded-lg bg-ink/10 px-2.5 py-1.5 text-xs font-bold"
              >
                ← Retour
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 rounded-lg bg-ink/5 p-1 text-xs font-extrabold">
              <button type="button" onClick={() => setHistoryView("journal")} className={`rounded-md px-3 py-1.5 ${historyView === "journal" ? "bg-white shadow-sm" : "opacity-65"}`}>Journal</button>
              <button type="button" onClick={() => setHistoryView("profit")} className={`rounded-md px-3 py-1.5 ${historyView === "profit" ? "bg-white shadow-sm" : "opacity-65"}`}>Rentabilité</button>
            </div>

            {historyView === "profit" ? (
              <div className="mt-3 overflow-y-auto">
                <dl className="grid grid-cols-2 gap-2">
                  {[["Revenus", financeIncome, "text-splash"], ["Dépenses", financeExpenses, ""], ["Profit net", financeIncome - financeExpenses, financeIncome >= financeExpenses ? "text-splash" : "text-destructive"]].map(([label, value, color]) => <div key={String(label)} className="rounded-lg bg-ink/5 p-2 ring-1 ring-ink/10"><dt className="text-[10px] font-bold opacity-60">{label}</dt><dd className={`text-lg font-black tabular-nums ${color}`}>{Number(value).toLocaleString("fr-FR")} €</dd></div>)}
                  <div className="rounded-lg bg-sunny/20 p-2 ring-1 ring-sunny/30"><dt className="text-[10px] font-bold opacity-60">TEMPS DE JEU</dt><dd className="text-lg font-black">{formatPlayTime(playSeconds)}</dd></div>
                </dl>
                <div className="mt-3 rounded-lg border border-ink/10 p-3">
                  <div className="flex items-center gap-2"><h3 className="text-sm font-extrabold">Période actuelle · 30 min</h3><span className={`ml-auto text-sm font-black ${currentProfit >= 0 ? "text-splash" : "text-destructive"}`}>{currentProfit >= 0 ? "+" : ""}{currentProfit.toLocaleString("fr-FR")} €</span></div>
                  <p className="mt-1 text-xs font-semibold opacity-65">Revenus {currentFinancePeriod?.income.toLocaleString("fr-FR") ?? 0} € · dépenses {currentFinancePeriod?.expenses.toLocaleString("fr-FR") ?? 0} €</p>
                  {previousFinancePeriod && <p className="mt-2 text-xs font-bold">Évolution : {currentProfit - previousProfit >= 0 ? "↗" : "↘"} {Math.abs(currentProfit - previousProfit).toLocaleString("fr-FR")} € par rapport à la période précédente</p>}
                </div>
                <div className="mt-3 divide-y divide-ink/10 rounded-lg border border-ink/10">
                  {[...financePeriods].reverse().map((period) => <div key={period.index} className="grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs"><span className="font-bold">Mois {period.index + 1}</span><span className="font-black tabular-nums">+{period.income.toLocaleString("fr-FR")} € · −{period.expenses.toLocaleString("fr-FR")} € · {(period.income - period.expenses).toLocaleString("fr-FR")} €</span></div>)}
                </div>
              </div>
            ) : <>

            {/* Bilan global */}
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                ["Lavages", `${economy.washes}`, "🫧"],
                [
                  "Gagné",
                  `${history
                    .filter((e) => (e.amount ?? 0) > 0)
                    .reduce((s, e) => s + (e.amount ?? 0), 0)
                    .toLocaleString("fr-FR")} €`,
                  "📈",
                ],
                [
                  "Dépensé",
                  `${history
                    .filter((e) => (e.amount ?? 0) < 0)
                    .reduce((s, e) => s - (e.amount ?? 0), 0)
                    .toLocaleString("fr-FR")} €`,
                  "📉",
                ],
              ].map(([label, value, icon]) => (
                <div
                  key={label}
                  className="rounded-2xl bg-splash/10 px-2 py-1.5 text-center ring-1 ring-ink/10"
                >
                  <p className="text-[11px] font-semibold opacity-70">
                    {icon} {label}
                  </p>
                  <p className="text-[14px] font-extrabold tabular-nums">{value}</p>
                </div>
              ))}
            </div>

            {/* Filtres par type d'événement */}
            <div className="mt-2 flex flex-wrap gap-1">
              {(
                [["all", "Tout", "📚"]] as Array<[EventKind | "all", string, string]>
              )
                .concat(
                  (Object.keys(EVENT_META) as EventKind[]).map((k) => [
                    k,
                    EVENT_META[k].label,
                    EVENT_META[k].icon,
                  ]),
                )
                .map(([key, label, icon]) => {
                  const count =
                    key === "all"
                      ? history.length
                      : history.filter((e) => e.kind === key).length;
                  if (key !== "all" && count === 0) return null;
                  const active = historyFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setHistoryFilter(key)}
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ring-1 ring-ink/10 ${
                        active ? "bg-splash text-splash-foreground" : "bg-ink/[0.05]"
                      }`}
                    >
                      {icon} {label} {count > 0 && <span className="opacity-70">{count}</span>}
                    </button>
                  );
                })}
            </div>

            {history.length === 0 ? (
              <p className="mt-4 text-[13px] opacity-75">
                Rien à afficher pour l'instant. Chaque lavage, achat d'amélioration ou
                construction s'inscrira ici avec l'heure, le montant et le solde.
              </p>
            ) : (
              <>
                <ul className="mt-2 flex-1 overflow-y-auto pr-1">
                  {history
                    .filter((e) => historyFilter === "all" || e.kind === historyFilter)
                    .map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-2 rounded-xl px-1 py-2 text-[13px] odd:bg-ink/[0.04]"
                      >
                        <span aria-hidden className="text-[15px]">
                          {EVENT_META[e.kind].icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{e.label}</span>
                          <span className="block text-[11px] tabular-nums opacity-60">
                            {formatWashDate(e.at)}
                          </span>
                        </span>
                        {e.amount !== undefined && (
                          <span
                            className={`w-[68px] text-right font-extrabold tabular-nums ${
                              e.amount >= 0 ? "text-splash" : "opacity-70"
                            }`}
                          >
                            {e.amount >= 0 ? "+" : "−"}
                            {Math.abs(e.amount).toLocaleString("fr-FR")} €
                          </span>
                        )}
                        {e.balance !== undefined && (
                          <span className="w-[70px] text-right text-[12px] font-bold tabular-nums opacity-70">
                            {e.balance.toLocaleString("fr-FR")} €
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
                <p className="mt-2 text-[11px] opacity-60">
                  {history.length} événement{history.length > 1 ? "s" : ""} conservé
                  {history.length > 1 ? "s" : ""} (max {MAX_HISTORY}).
                </p>
              </>
            )}
            </>}
          </div>
        </div>
      )}

      {shopOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 backdrop-blur-sm sm:items-center">
          <div className="flex max-h-[92vh] w-full max-w-[440px] flex-col rounded-lg bg-white p-3 text-ink shadow-[0_12px_40px_rgba(6,58,94,0.35)]">
            <div className="flex items-center gap-2">
              <h2 className="min-w-0 truncate text-base font-extrabold">🛠️ Boutique du car wash</h2>
              <span className="ml-auto rounded-full bg-sunny/30 px-2 py-1 text-[13px] font-extrabold tabular-nums">
                {economy.money.toLocaleString("fr-FR")} €
              </span>
              <button
                type="button"
                onClick={() => {
                  setUpgradeInfoOpen(null);
                  setShopOpen(false);
                }}
                aria-label="Fermer la boutique"
                className="rounded-lg bg-ink/10 px-2.5 py-1.5 text-xs font-bold"
              >
                ← Retour
              </button>
            </div>

            <div className="mt-3 flex-1 overflow-y-auto pr-1">
              {(["Station", "Clientèle", "Équipe"] as const).map((cat) => (
                <div key={cat} className="mb-3">
                  <p className="px-1 text-[11px] font-bold uppercase tracking-wide opacity-60">
                    {cat}
                  </p>
                  <ul className="mt-1 flex flex-col gap-2">
                    {UPGRADES.filter((u) => u.category === cat).map((u) => {
                      const level = upgrades[u.key];
                      const maxed = level >= MAX_LEVEL;
                      const cost = maxed ? 0 : upgradeCost(u.key, level);
                      const affordable = !maxed && economy.money >= cost;
                      const preview = upgradePreview(u.key, level, upgrades);
                      return (
                        <li
                          key={u.key}
                          className="rounded-2xl bg-splash/10 px-3 py-2 ring-1 ring-ink/10"
                        >
                          <div className="flex items-center gap-2">
                            <span aria-hidden className="text-[18px]">
                              {u.icon}
                            </span>
                            <div className="min-w-0">
                              <p className="text-[14px] font-bold">
                                {u.label}{" "}
                                <span className="opacity-60">
                                  niv. {level}/{MAX_LEVEL}
                                </span>
                              </p>
                              <p className="text-[11.5px] opacity-75">{u.desc}</p>
                            </div>
                            <div className="ml-auto flex shrink-0 items-center gap-1.5">
                              <Popover
                                open={upgradeInfoOpen === u.key}
                                onOpenChange={(open) => setUpgradeInfoOpen(open ? u.key : null)}
                              >
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={`Voir les détails de ${u.label}`}
                                    aria-expanded={upgradeInfoOpen === u.key}
                                    onPointerEnter={(event) => {
                                      if (event.pointerType === "mouse") setUpgradeInfoOpen(u.key);
                                    }}
                                    onPointerLeave={(event) => {
                                      if (event.pointerType === "mouse") setUpgradeInfoOpen(null);
                                    }}
                                    onFocus={() => setUpgradeInfoOpen(u.key)}
                                    className="grid size-8 place-items-center rounded-full bg-ink/10 text-[15px] font-black ring-1 ring-ink/10"
                                  >
                                    i
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="top"
                                  align="end"
                                  collisionPadding={12}
                                  onPointerEnter={(event) => {
                                    if (event.pointerType === "mouse") setUpgradeInfoOpen(u.key);
                                  }}
                                  onPointerLeave={(event) => {
                                    if (event.pointerType === "mouse") setUpgradeInfoOpen(null);
                                  }}
                                  className="z-[70] w-[min(21rem,calc(100vw-1.5rem))] border-ink/15 bg-white p-3 text-ink shadow-xl"
                                >
                                  <div className="flex items-start gap-2">
                                    <span aria-hidden className="text-xl">{u.icon}</span>
                                    <div>
                                      <p className="text-sm font-extrabold">{u.label}</p>
                                      <p className="text-[11px] opacity-65">
                                        {maxed ? `Niveau maximal ${MAX_LEVEL}` : `Niveau ${level} → niveau ${level + 1}`}
                                      </p>
                                    </div>
                                    <span className="ml-auto rounded-full bg-sunny/30 px-2 py-1 text-xs font-extrabold tabular-nums">
                                      {maxed ? "MAX" : `${cost.toLocaleString("fr-FR")} €`}
                                    </span>
                                  </div>
                                  {maxed ? (
                                    <div className="mt-3 rounded-lg bg-sunny/20 p-2.5 text-xs font-semibold">
                                      Tout est débloqué : {preview.current}.
                                    </div>
                                  ) : (
                                    <>
                                      <dl className="mt-3 grid gap-2 text-xs">
                                        <div className="rounded-lg bg-ink/5 p-2">
                                          <dt className="font-bold opacity-60">Actuellement</dt>
                                          <dd className="mt-0.5 font-semibold">{preview.current}</dd>
                                        </div>
                                        <div className="rounded-lg bg-splash/15 p-2 ring-1 ring-splash/20">
                                          <dt className="font-bold text-splash">Après achat</dt>
                                          <dd className="mt-0.5 font-extrabold">{preview.next}</dd>
                                          <dd className="mt-1 font-bold text-splash">{preview.change}</dd>
                                        </div>
                                      </dl>
                                      <p className="mt-2 text-[11.5px] leading-relaxed opacity-80">
                                        <strong>Impact :</strong> {preview.impact}
                                      </p>
                                    </>
                                  )}
                                </PopoverContent>
                              </Popover>
                              <button
                                type="button"
                                disabled={maxed || purchasingUpgrade !== null}
                                onClick={() => requestUpgrade(u.key)}
                                aria-label={maxed ? `${u.label}, niveau maximal` : `Acheter ${u.label} niveau ${level + 1} pour ${cost} euros`}
                                className={`shrink-0 rounded-full px-3 py-2 text-[12px] font-bold transition-transform active:translate-y-0.5 ${
                                  maxed
                                    ? "bg-ink/10 opacity-60"
                                    : affordable
                                      ? "bg-splash text-splash-foreground"
                                      : "bg-ink/10 opacity-60"
                                }`}
                              >
                                {purchasingUpgrade === u.key
                                  ? "Achat…"
                                  : maxed
                                    ? "MAX"
                                    : `${cost.toLocaleString("fr-FR")} €`}
                              </button>
                            </div>
                          </div>
                          {/* Jauge de niveau */}
                          <div className="mt-1.5 flex gap-1">
                            {Array.from({ length: MAX_LEVEL }, (_, i) => (
                              <span
                                key={i}
                                className={`h-1.5 flex-1 rounded-full ${
                                  i < level ? "bg-sunny" : "bg-ink/10"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="mt-1 text-[11.5px] font-semibold opacity-80">
                            Actuel : {u.effect(level)}
                            {!maxed && <> → {u.effect(level + 1)}</>}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <p className="mt-1 text-[11.5px] opacity-70">
              Les routes restent gratuites : l'argent sert aux améliorations, aux maisons et
              aux aménagements.
            </p>
          </div>
        </div>
      )}



      <div
        className={`hidden fixed right-2 top-2 z-40 w-[132px] rounded-2xl bg-white/90 ring-1 ring-ink/10 p-1.5 sm:right-4 sm:top-4 sm:w-[190px] sm:p-2 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur ${
          buildMode ? "hidden" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setControlOpen((v) => !v)}
          aria-expanded={controlOpen}
          className="flex w-full items-center gap-1 rounded-xl px-1.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-ink opacity-80"
        >
          ⚙️ Machines
          <span aria-hidden className="ml-auto text-[10px]">
            {controlOpen ? "▲" : "▼"}
          </span>
        </button>
        {controlOpen && (
          <div className="mt-1.5 flex flex-col gap-1.5">
            {(
              [
                ["belt", "🛤️ Tapis"],
                ["rollers", "🌀 Rouleaux"],
                ["brushes", "🧽 Brosses"],
                ["traffic", "🚦 Trafic"],
              ] as Array<[keyof typeof machines, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleMachine(key)}
                aria-pressed={machines[key]}
                className={`flex items-center justify-between rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-colors sm:px-3 sm:py-2 sm:text-[12.5px] ${
                  machines[key]
                    ? "bg-splash text-splash-foreground"
                    : "bg-ink/10 text-ink opacity-70"
                }`}
              >
                <span>{label}</span>
                <span className="text-[11px]">{machines[key] ? "ON" : "OFF"}</span>
              </button>
            ))}
          </div>
        )}
      </div>


      <div
        className={`hidden fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-2xl bg-white/80 p-2.5 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur ${
          buildMode ? "hidden" : ""
        }`}
      >
        <button

          type="button"
          onClick={() => cinemaRef.current()}
          aria-pressed={cinema}
          className="rounded-full bg-sunny px-3.5 py-2.5 text-[12.5px] font-bold text-sunny-foreground shadow-[0_3px_0_var(--sunny-shadow)] transition-transform active:translate-y-0.5 active:shadow-[0_1px_0_var(--sunny-shadow)]"
        >
          🎥 {cinema ? "Vue libre" : "Vue cinéma"}
        </button>
        <div className="relative" data-drive-menu>
          <button
            type="button"
            disabled={driveState === "saving" || loadState === "loading"}
            onClick={() => setDriveMenuOpen((v) => !v)}
            aria-expanded={driveMenuOpen}
            className="rounded-full bg-ink/10 px-3 py-2.5 text-[12.5px] font-bold text-ink transition-transform active:translate-y-0.5 disabled:opacity-60"
          >
            ☁️ Drive
          </button>
          {driveMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 flex w-44 flex-col gap-1.5 rounded-2xl bg-white/95 p-2 shadow-[0_6px_20px_rgba(6,58,94,0.18)] backdrop-blur">
              <button
                type="button"
                disabled={driveState === "saving" || loadState === "loading"}
                onClick={handleSaveToDrive}
                className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition-colors active:bg-ink/10 disabled:opacity-60"
              >
                <span>
                  {driveState === "saving"
                    ? "⏳ Envoi..."
                    : driveState === "done"
                      ? "✅ Sauvé"
                      : driveState === "error"
                        ? "⚠️ Réessayer"
                        : "☁️ Sauvegarder"}
                </span>
              </button>
              <button
                type="button"
                disabled={loadState === "loading" || driveState === "saving"}
                onClick={handleLoadFromDrive}
                className="flex items-center justify-between rounded-xl bg-ink/5 px-3 py-2 text-left text-[12.5px] font-semibold text-ink transition-colors active:bg-ink/10 disabled:opacity-60"
              >
                <span>
                  {loadState === "loading"
                    ? "⏳ Lecture..."
                    : loadState === "done"
                      ? "✅ Chargé"
                      : loadState === "error"
                        ? "⚠️ Réessayer"
                        : "📥 Charger"}
                </span>
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Hors construction : bouton d'entrée en mode construction */}
      {!buildMode && (
        <div className="hidden fixed bottom-4 left-1/2 z-40 -translate-x-1/2">
          <button
            type="button"
            onClick={toggleBuild}
            aria-pressed={false}
            className="rounded-full bg-white/90 px-4 py-2.5 text-[12.5px] font-bold text-ink shadow-[0_6px_20px_rgba(6,58,94,0.18)] transition-transform active:translate-y-0.5"
          >
            🏗️ Construire
          </button>
        </div>
      )}

      {/* Mode construction plein écran : une seule barre ancrée en bas,
          onglets + outils de la catégorie active, la vue 3D reste dégagée. */}
      {buildMode && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/92 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 shadow-[0_-6px_20px_rgba(6,58,94,0.14)] backdrop-blur">
          <div className="mx-auto flex w-[min(100vw,900px)] flex-col gap-1.5 px-2">
            <div className="flex items-center gap-2 rounded-2xl bg-slate-100 p-1.5 ring-1 ring-slate-200">
              <button
                type="button"
                onClick={toggleBuildCamera}
                aria-pressed={buildCameraMode}
                className={`flex-1 rounded-xl px-3 py-2 text-[12px] font-extrabold transition-colors ${
                  buildCameraMode ? "bg-slate-900 text-white" : "bg-white text-slate-900 shadow-sm"
                }`}
              >
                {buildCameraMode ? "🧱 Reprendre la pose" : "✋ Déplacer / zoomer"}
              </button>
              <span className="hidden flex-1 text-[11px] font-semibold text-slate-600 sm:block">
                {buildCameraMode ? "1 doigt = tourner · 2 doigts = déplacer/zoomer" : "Glisse sur la grille pour poser en continu"}
              </span>
            </div>
            {/* Onglets de catégories */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {BUILD_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => chooseCategory(c.id)}
                  aria-pressed={buildCat === c.id}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                    buildCat === c.id ? "bg-ink text-white" : "bg-ink/10 text-ink"
                  }`}
                >
                  {c.icon} {c.label}
                </button>
              ))}
              <button
                type="button"
                onClick={toggleBuild}
                className="ml-auto shrink-0 rounded-full bg-splash px-3 py-1.5 text-[11.5px] font-bold text-splash-foreground"
              >
                ✓ Terminer
              </button>
            </div>

            {/* Outils de la catégorie active */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(BUILD_CATEGORIES.find((c) => c.id === buildCat)?.tools ?? []).map((t) => {
                const unlocked = districtUnlocks(districtLevel).tools.has(t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      if (!unlocked) {
                        toast.info("Outil débloqué à un palier supérieur du quartier.");
                        return;
                      }
                      chooseTool(t);
                    }}
                    aria-pressed={tool === t}
                    className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                      tool === t ? "bg-splash text-splash-foreground" : "bg-ink/10 text-ink"
                    } ${unlocked ? "" : "opacity-45"}`}
                  >
                    {unlocked ? TOOL_LABEL[t] : `🔒 ${TOOL_LABEL[t]}`}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const next = (rotRef.current + 1) % 4;
                  rotRef.current = next;
                  setRot(next);
                }}
                className="ml-auto shrink-0 rounded-xl bg-sunny px-2.5 py-1.5 text-[11.5px] font-bold text-sunny-foreground"
              >
                🔄 {rot * 90}°
              </button>
            </div>

            {/* Variantes de l'outil actif */}
            {tool === "house" && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-t border-ink/10 pt-1.5">
                {HOUSE_LEVELS.map((h) => {
                  const unlocked = h.level <= districtUnlocks(districtLevel).houseLevel;
                  return (
                    <button
                      key={h.level}
                      type="button"
                      onClick={() =>
                        unlocked
                          ? chooseHouseLevel(h.level)
                          : toast("🔒 Ce type de maison s’ouvre à un palier supérieur du quartier.")
                      }
                      aria-pressed={houseLevel === h.level}
                      className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                        houseLevel === h.level
                          ? "bg-sunny text-sunny-foreground"
                          : "bg-ink/10 text-ink"
                      } ${unlocked ? "" : "opacity-45"}`}
                    >
                      {unlocked ? h.icon : "🔒"} Niv.{h.level} · {h.cost} € · {h.capacity} hab.
                    </button>
                  );
                })}
              </div>
            )}

            {(tool === "park" || tool === "parking") && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-t border-ink/10 pt-1.5">
                {decorOf(tool as DecorCategory).map((d) => {
                  const unlocked = districtUnlocks(districtLevel).decor.has(d.kind);
                  return (
                    <button
                      key={d.kind}
                      type="button"
                      onClick={() =>
                        unlocked
                          ? chooseDecor(d.kind)
                          : toast("🔒 Cet aménagement s’ouvre à un palier supérieur du quartier.")
                      }
                      aria-pressed={decorKind[tool as DecorCategory] === d.kind}
                      className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                        decorKind[tool as DecorCategory] === d.kind
                          ? "bg-sunny text-sunny-foreground"
                          : "bg-ink/10 text-ink"
                      } ${unlocked ? "" : "opacity-45"}`}
                    >
                      {unlocked ? d.icon : "🔒"} {d.label} · {d.cost} €
                    </button>
                  );
                })}
              </div>
            )}


            {tool === "wash" && (
              <div className="flex items-center gap-1.5 overflow-x-auto border-t border-ink/10 pt-1.5">
                {WASH_COLORS.map((c, i) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => applyWashStyle({ color: i })}
                    aria-pressed={washStyle.color === i}
                    aria-label={c.label}
                    className={`h-7 w-7 shrink-0 rounded-full border-2 transition-transform ${
                      washStyle.color === i ? "scale-110 border-ink" : "border-white/70"
                    }`}
                    style={{ backgroundColor: `#${c.hex.toString(16).padStart(6, "0")}` }}
                  />
                ))}
                {(
                  [
                    ["sign", "🪧 Enseigne"],
                    ["neon", "✨ Néon"],
                    ["plants", "🪴 Plantes"],
                    ["flags", "🎏 Fanions"],
                  ] as Array<[keyof WashStyle, string]>
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyWashStyle({ [k]: !washStyle[k] } as Partial<WashStyle>)}
                    aria-pressed={!!washStyle[k]}
                    className={`shrink-0 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      washStyle[k] ? "bg-splash text-splash-foreground" : "bg-ink/10 text-ink"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>

  );
}
