const starChances = {
    star10: 100,
    star50: 0,
    star100: 0,
    star300: 0,
  };

  function getRandomByChance(chances) {
    const total = Object.values(chances).reduce((sum, val) => sum + val, 0);
    const rand = Math.random() * total;
    let cumulative = 0;
  
    for (const [key, value] of Object.entries(chances)) {
      cumulative += value;
      if (rand < cumulative) {
        return key;
      }
    }
  }
console.log(getRandomByChance(starChances))