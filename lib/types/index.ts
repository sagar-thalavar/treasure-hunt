export type RewardType =
  | "cash"
  | "coupon"
  | "collectible"
  | "digital"
  | "badge"
  | "premium"
  | "discount_code"
  | "physical"
  | "xp";

export type Difficulty = "easy" | "medium" | "hard" | "legendary";

export type Visibility = "public" | "private";

export type ModerationStatus = "pending" | "approved" | "rejected";

export type Role = "user" | "admin";

export type ExplorerLevel =
  | "Beginner"
  | "Scout"
  | "Explorer"
  | "Adventurer"
  | "Master Explorer"
  | "Legend"
  | "World Explorer";

export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  level: number;
  xp: number;
  coins: number;
  reputation: number;
  role: Role;
  points_balance: number;
  created_at: string;
}

export interface Treasure {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  hint: string | null;
  reward_type: RewardType | null;
  reward_description: string | null;
  reward_value: number | null;
  latitude: number;
  longitude: number;
  difficulty: Difficulty;
  radius_meters: number;
  expiry_date: string | null;
  image_url: string | null;
  visibility: Visibility;
  is_active: boolean;
  status: ModerationStatus;
  rejection_reason: string | null;
  points_staked: number;
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  creator?: Profile;
  claim_count?: number;
}

export interface Claim {
  id: string;
  treasure_id: string;
  player_id: string;
  verification_method: string;
  verified_latitude: number;
  verified_longitude: number;
  photo_url: string | null;
  status: ModerationStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  claimed_at: string;
  treasure?: Treasure;
  player?: Profile;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  condition_type: string;
  condition_value: number;
}

export interface PlayerBadge {
  player_id: string;
  badge_id: string;
  earned_at: string;
  badge?: Badge;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: string;
  username: string;
  avatar_url: string | null;
  xp: number;
  level: number;
  claim_count: number;
}
