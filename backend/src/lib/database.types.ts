export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bonding_curve_params: {
        Row: {
          base_price: number
          created_at: string
          current_market_cap: number
          current_price: number
          curve_type: string
          index_id: string
          linear_slope: number | null
          max_price: number | null
          midpoint: number | null
          progress: number
          sigmoid_slope: number | null
          target_market_cap: number
          total_raised: number
          transition_point: number | null
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          current_market_cap?: number
          current_price?: number
          curve_type: string
          index_id: string
          linear_slope?: number | null
          max_price?: number | null
          midpoint?: number | null
          progress?: number
          sigmoid_slope?: number | null
          target_market_cap: number
          total_raised?: number
          transition_point?: number | null
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          current_market_cap?: number
          current_price?: number
          curve_type?: string
          index_id?: string
          linear_slope?: number | null
          max_price?: number | null
          midpoint?: number | null
          progress?: number
          sigmoid_slope?: number | null
          target_market_cap?: number
          total_raised?: number
          transition_point?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bonding_curve_params_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: true
            referencedRelation: "indices"
            referencedColumns: ["id"]
          },
        ]
      }
      funding_rounds: {
        Row: {
          cliff_months: number
          created_at: string
          current_raise: number
          discount_percent: number
          end_time: string
          id: string
          max_investment: number
          min_investment: number
          name: string
          price_per_token: number
          start_time: string
          status: string
          target_raise: number
          vesting_months: number
        }
        Insert: {
          cliff_months: number
          created_at?: string
          current_raise?: number
          discount_percent: number
          end_time: string
          id?: string
          max_investment: number
          min_investment: number
          name: string
          price_per_token: number
          start_time: string
          status?: string
          target_raise: number
          vesting_months: number
        }
        Update: {
          cliff_months?: number
          created_at?: string
          current_raise?: number
          discount_percent?: number
          end_time?: string
          id?: string
          max_investment?: number
          min_investment?: number
          name?: string
          price_per_token?: number
          start_time?: string
          status?: string
          target_raise?: number
          vesting_months?: number
        }
        Relationships: []
      }
      index_components: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          id: string
          index_id: string
          symbol: string
          weight: number
        }
        Insert: {
          address: string
          chain_id?: number
          created_at?: string
          id?: string
          index_id: string
          symbol: string
          weight: number
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          id?: string
          index_id?: string
          symbol?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "index_components_index_id_fkey"
            columns: ["index_id"]
            isOneToOne: false
            referencedRelation: "indices"
            referencedColumns: ["id"]
          },
        ]
      }
      indices: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          holders: number
          id: string
          layer: string
          management_fee: number
          name: string
          performance_fee: number | null
          status: string
          symbol: string
          total_value_locked: number
          updated_at: string
          volume_24h: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          holders?: number
          id?: string
          layer: string
          management_fee: number
          name: string
          performance_fee?: number | null
          status?: string
          symbol: string
          total_value_locked?: number
          updated_at?: string
          volume_24h?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          holders?: number
          id?: string
          layer?: string
          management_fee?: number
          name?: string
          performance_fee?: number | null
          status?: string
          symbol?: string
          total_value_locked?: number
          updated_at?: string
          volume_24h?: number
        }
        Relationships: [
          {
            foreignKeyName: "indices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      investments: {
        Row: {
          claimed_amount: number
          created_at: string
          id: string
          investment_amount: number
          price_per_token: number
          remaining_amount: number
          round_id: string
          round_name: string
          token_amount: number
          user_id: string
          vesting_cliff_end_time: string
          vesting_end_time: string
          vesting_start_time: string
          vesting_total: number
        }
        Insert: {
          claimed_amount?: number
          created_at?: string
          id?: string
          investment_amount: number
          price_per_token: number
          remaining_amount: number
          round_id: string
          round_name: string
          token_amount: number
          user_id: string
          vesting_cliff_end_time: string
          vesting_end_time: string
          vesting_start_time: string
          vesting_total: number
        }
        Update: {
          claimed_amount?: number
          created_at?: string
          id?: string
          investment_amount?: number
          price_per_token?: number
          remaining_amount?: number
          round_id?: string
          round_name?: string
          token_amount?: number
          user_id?: string
          vesting_cliff_end_time?: string
          vesting_end_time?: string
          vesting_start_time?: string
          vesting_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "investments_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "funding_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      token_holders: {
        Row: {
          balance: number
          created_at: string
          locked: number
          rewards: number
          staked: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          locked?: number
          rewards?: number
          staked?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          locked?: number
          rewards?: number
          staked?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_holders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      token_transactions: {
        Row: {
          amount: number
          created_at: string
          from_user: string | null
          id: string
          reason: string
          to_user: string | null
          tx_hash: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user?: string | null
          id?: string
          reason: string
          to_user?: string | null
          tx_hash?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user?: string | null
          id?: string
          reason?: string
          to_user?: string | null
          tx_hash?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "token_transactions_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_transactions_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "token_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          last_login_at: string | null
          privy_user_id: string
          updated_at: string
          wallet_address: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          privy_user_id: string
          updated_at?: string
          wallet_address: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          last_login_at?: string | null
          privy_user_id?: string
          updated_at?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

