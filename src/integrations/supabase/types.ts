export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      battle_challenges: {
        Row: {
          accepter_id: string | null
          accepter_spider_id: string | null
          battle_id: string | null
          challenge_message: string | null
          challenger_id: string
          challenger_spider_id: string
          created_at: string
          expires_at: string
          id: string
          loser_spider_id: string | null
          status: string
          winner_id: string | null
        }
        Insert: {
          accepter_id?: string | null
          accepter_spider_id?: string | null
          battle_id?: string | null
          challenge_message?: string | null
          challenger_id: string
          challenger_spider_id: string
          created_at?: string
          expires_at?: string
          id?: string
          loser_spider_id?: string | null
          status?: string
          winner_id?: string | null
        }
        Update: {
          accepter_id?: string | null
          accepter_spider_id?: string | null
          battle_id?: string | null
          challenge_message?: string | null
          challenger_id?: string
          challenger_spider_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          loser_spider_id?: string | null
          status?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "battle_challenges_accepter_spider_id_fkey"
            columns: ["accepter_spider_id"]
            isOneToOne: false
            referencedRelation: "spiders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_challenges_challenger_spider_id_fkey"
            columns: ["challenger_spider_id"]
            isOneToOne: false
            referencedRelation: "spiders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "battle_challenges_loser_spider_id_fkey"
            columns: ["loser_spider_id"]
            isOneToOne: false
            referencedRelation: "spiders"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          battle_log: Json | null
          created_at: string | null
          id: string
          rng_seed: string
          team_a: Json
          team_b: Json
          type: Database["public"]["Enums"]["battle_type"]
          winner: Database["public"]["Enums"]["battle_winner"] | null
        }
        Insert: {
          battle_log?: Json | null
          created_at?: string | null
          id?: string
          rng_seed: string
          team_a: Json
          team_b: Json
          type?: Database["public"]["Enums"]["battle_type"]
          winner?: Database["public"]["Enums"]["battle_winner"] | null
        }
        Update: {
          battle_log?: Json | null
          created_at?: string | null
          id?: string
          rng_seed?: string
          team_a?: Json
          team_b?: Json
          type?: Database["public"]["Enums"]["battle_type"]
          winner?: Database["public"]["Enums"]["battle_winner"] | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          likes_count: number
          parent_comment_id: string | null
          post_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_comment_id?: string | null
          post_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          parent_comment_id?: string | null
          post_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      matchups: {
        Row: {
          battle_id: string | null
          created_at: string | null
          id: string
          result: Database["public"]["Enums"]["matchup_result"] | null
          season_id: string
          team_a: Json | null
          team_b: Json | null
          updated_at: string | null
          user_a_id: string
          user_b_id: string
          week_id: string
        }
        Insert: {
          battle_id?: string | null
          created_at?: string | null
          id?: string
          result?: Database["public"]["Enums"]["matchup_result"] | null
          season_id: string
          team_a?: Json | null
          team_b?: Json | null
          updated_at?: string | null
          user_a_id: string
          user_b_id: string
          week_id: string
        }
        Update: {
          battle_id?: string | null
          created_at?: string | null
          id?: string
          result?: Database["public"]["Enums"]["matchup_result"] | null
          season_id?: string
          team_a?: Json | null
          team_b?: Json | null
          updated_at?: string | null
          user_a_id?: string
          user_b_id?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchups_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matchups_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          comments_count: number
          content: string
          created_at: string
          id: string
          likes_count: number
          shares_count: number
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comments_count?: number
          content: string
          created_at?: string
          id?: string
          likes_count?: number
          shares_count?: number
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comments_count?: number
          content?: string
          created_at?: string
          id?: string
          likes_count?: number
          shares_count?: number
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          google_id: string | null
          id: string
          rating_elo: number | null
          season_losses: number | null
          season_ties: number | null
          season_wins: number | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          google_id?: string | null
          id: string
          rating_elo?: number | null
          season_losses?: number | null
          season_ties?: number | null
          season_wins?: number | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          google_id?: string | null
          id?: string
          rating_elo?: number | null
          season_losses?: number | null
          season_ties?: number | null
          season_wins?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      roadmap_items: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
          upvote_count: number
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          priority: string
          status: string
          title: string
          updated_at?: string
          upvote_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          upvote_count?: number
        }
        Relationships: []
      }
      roadmap_upvotes: {
        Row: {
          created_at: string
          id: string
          roadmap_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          roadmap_item_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          roadmap_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_upvotes_roadmap_item_id_fkey"
            columns: ["roadmap_item_id"]
            isOneToOne: false
            referencedRelation: "roadmap_items"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string | null
          current_week_number: number | null
          end_date: string
          id: string
          name: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_week_number?: number | null
          end_date: string
          id?: string
          name: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_week_number?: number | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      spiders: {
        Row: {
          created_at: string | null
          damage: number
          defense: number
          hit_points: number
          id: string
          image_url: string
          is_approved: boolean | null
          nickname: string
          owner_id: string
          power_score: number
          rarity: Database["public"]["Enums"]["spider_rarity"]
          rng_seed: string
          special_attacks: Json | null
          species: string
          speed: number
          updated_at: string | null
          venom: number
          webcraft: number
        }
        Insert: {
          created_at?: string | null
          damage: number
          defense: number
          hit_points: number
          id?: string
          image_url: string
          is_approved?: boolean | null
          nickname: string
          owner_id: string
          power_score?: number
          rarity?: Database["public"]["Enums"]["spider_rarity"]
          rng_seed: string
          special_attacks?: Json | null
          species?: string
          speed: number
          updated_at?: string | null
          venom: number
          webcraft: number
        }
        Update: {
          created_at?: string | null
          damage?: number
          defense?: number
          hit_points?: number
          id?: string
          image_url?: string
          is_approved?: boolean | null
          nickname?: string
          owner_id?: string
          power_score?: number
          rarity?: Database["public"]["Enums"]["spider_rarity"]
          rng_seed?: string
          special_attacks?: Json | null
          species?: string
          speed?: number
          updated_at?: string | null
          venom?: number
          webcraft?: number
        }
        Relationships: [
          {
            foreignKeyName: "spiders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_rankings: {
        Row: {
          created_at: string
          id: string
          power_score: number
          rank_position: number | null
          spider_id: string
          updated_at: string
          week_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          power_score: number
          rank_position?: number | null
          spider_id: string
          updated_at?: string
          week_id: string
        }
        Update: {
          created_at?: string
          id?: string
          power_score?: number
          rank_position?: number | null
          spider_id?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_rankings_spider_id_fkey"
            columns: ["spider_id"]
            isOneToOne: false
            referencedRelation: "spiders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_rankings_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      weeks: {
        Row: {
          created_at: string | null
          end_date: string
          id: string
          is_locked: boolean | null
          season_id: string
          start_date: string
          week_number: number
        }
        Insert: {
          created_at?: string | null
          end_date: string
          id?: string
          is_locked?: boolean | null
          season_id: string
          start_date: string
          week_number: number
        }
        Update: {
          created_at?: string | null
          end_date?: string
          id?: string
          is_locked?: boolean | null
          season_id?: string
          start_date?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "weeks_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_species_bias: {
        Args: {
          in_damage: number
          in_defense: number
          in_hit_points: number
          in_speed: number
          in_venom: number
          in_webcraft: number
          species: string
        }
        Returns: {
          damage: number
          defense: number
          hit_points: number
          speed: number
          venom: number
          webcraft: number
        }[]
      }
      get_current_week: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      resolve_battle_challenge: {
        Args: {
          battle_id_param: string
          challenge_id: string
          loser_user_id: string
          winner_user_id: string
        }
        Returns: undefined
      }
      transfer_spider_ownership: {
        Args: { new_owner_id: string; spider_id: string }
        Returns: undefined
      }
      update_weekly_rankings: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      battle_type: "SANDBOX" | "MATCHUP"
      battle_winner: "A" | "B" | "TIE"
      matchup_result: "A_WIN" | "B_WIN" | "TIE" | "NO_CONTEST"
      spider_rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      battle_type: ["SANDBOX", "MATCHUP"],
      battle_winner: ["A", "B", "TIE"],
      matchup_result: ["A_WIN", "B_WIN", "TIE", "NO_CONTEST"],
      spider_rarity: ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"],
    },
  },
} as const
