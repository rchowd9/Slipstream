#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Loadout {
    Vanguard,
    Striker,
    Phase,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct LoadoutProfile {
    pub max_health: f64,
    pub damage_multiplier: f64,
    pub dash_cooldown: f64,
}

impl Loadout {
    pub const fn profile(self) -> LoadoutProfile {
        match self {
            Self::Vanguard => LoadoutProfile {
                max_health: 118.0,
                damage_multiplier: 0.9,
                dash_cooldown: 1.02,
            },
            Self::Striker => LoadoutProfile {
                max_health: 100.0,
                damage_multiplier: 1.16,
                dash_cooldown: 0.92,
            },
            Self::Phase => LoadoutProfile {
                max_health: 88.0,
                damage_multiplier: 0.98,
                dash_cooldown: 0.66,
            },
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AttackKind {
    Basic,
    Special,
}

impl AttackKind {
    const fn base_damage(self) -> f64 {
        match self {
            Self::Basic => 16.0,
            Self::Special => 34.0,
        }
    }
}

pub fn attack_damage(loadout: Loadout, attack: AttackKind, director_scale: f64) -> f64 {
    attack.base_damage() * loadout.profile().damage_multiplier * director_scale
}

pub fn damage_after_guard(damage: f64, is_blocking: bool) -> f64 {
    if is_blocking {
        damage * 0.35
    } else {
        damage
    }
}

pub fn is_perfect_guard(is_blocking: bool, attack_elapsed: f64, horizontal_distance: f64) -> bool {
    is_blocking
        && attack_elapsed > 0.06
        && attack_elapsed < 0.18
        && horizontal_distance.abs() < 160.0
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct MatchStats {
    pub damage: f64,
    pub hits: u32,
    pub best_combo: u32,
    pub perfect_guards: u32,
}

pub fn match_score(stats: MatchStats) -> u32 {
    (stats.damage
        + f64::from(stats.hits) * 12.0
        + f64::from(stats.best_combo) * 18.0
        + f64::from(stats.perfect_guards) * 25.0)
        .round() as u32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loadout_profiles_match_the_game() {
        assert_eq!(
            Loadout::Vanguard.profile(),
            LoadoutProfile {
                max_health: 118.0,
                damage_multiplier: 0.9,
                dash_cooldown: 1.02,
            }
        );
        assert_eq!(Loadout::Striker.profile().damage_multiplier, 1.16);
        assert_eq!(Loadout::Phase.profile().dash_cooldown, 0.66);
    }

    #[test]
    fn attack_damage_applies_loadout_and_director_multipliers() {
        assert_eq!(
            attack_damage(Loadout::Striker, AttackKind::Basic, 1.45),
            16.0 * 1.16 * 1.45
        );
        assert_eq!(
            attack_damage(Loadout::Vanguard, AttackKind::Special, 1.0),
            34.0 * 0.9
        );
    }

    #[test]
    fn blocking_reduces_damage_to_thirty_five_percent() {
        assert_eq!(damage_after_guard(20.0, true), 7.0);
        assert_eq!(damage_after_guard(20.0, false), 20.0);
    }

    #[test]
    fn perfect_guard_uses_strict_time_and_distance_windows() {
        assert!(is_perfect_guard(true, 0.1, -159.0));
        assert!(!is_perfect_guard(true, 0.06, 0.0));
        assert!(!is_perfect_guard(true, 0.18, 0.0));
        assert!(!is_perfect_guard(true, 0.1, 160.0));
        assert!(!is_perfect_guard(false, 0.1, 0.0));
    }

    #[test]
    fn match_score_rounds_the_combined_combat_stats() {
        assert_eq!(
            match_score(MatchStats {
                damage: 10.5,
                hits: 2,
                best_combo: 3,
                perfect_guards: 1,
            }),
            114
        );
    }
}
