import { AppConfigs } from "@/lib/config.js"
import { mikroormPostgresConfig } from './postgres.js';
import { mikroormSqliteConfig } from './sqlite.js'

const configs = (() => {
  switch (AppConfigs.database.type) {
    case 'postgres': {
      return mikroormPostgresConfig()
    }
    case 'sqlite': {
      return mikroormSqliteConfig()
    }
  }
})()

export default configs;