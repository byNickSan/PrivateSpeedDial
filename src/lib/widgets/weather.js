// Layer: widget. Weather (net). Open-Meteo (no key) by default; AccuWeather / OpenWeatherMap /
// WeatherAPI / Tomorrow.io are opt-in and need the user's own API key. Every provider is normalized to
// the same shape { temp, code(WMO), isDay, humidity, wind, tempUnit, windUnit, place, tz, hourly[], daily[] }.
(function () {
  "use strict";
  var PROVIDERS = [
    ["open-meteo", "Open-Meteo"],
    ["accuweather", "AccuWeather"],
    ["openweather", "OpenWeatherMap"],
    ["weatherapi", "WeatherAPI"],
    ["tomorrow", "Tomorrow.io"]
  ];
  var HOSTS = {
    "open-meteo": "https://api.open-meteo.com",
    accuweather: "https://dataservice.accuweather.com",
    openweather: "https://api.openweathermap.org",
    weatherapi: "https://api.weatherapi.com",
    tomorrow: "https://api.tomorrow.io"
  };
  // Where the user gets a free key per provider (shown as a help link in settings).
  var KEY_URLS = {
    accuweather: "https://developer.accuweather.com/",
    openweather: "https://home.openweathermap.org/api_keys",
    weatherapi: "https://www.weatherapi.com/signup.aspx",
    tomorrow: "https://app.tomorrow.io/development/keys"
  };

  function enc(v) { return encodeURIComponent(v); }
  function needsKey(p) { return !!p && p !== "open-meteo"; }
  function provKey(cfg) { return (cfg.keys && cfg.keys[cfg.provider]) || ""; }
  function origin(cfg) { return HOSTS[(cfg && cfg.provider)] || HOSTS["open-meteo"]; }
  function fj(u) { return SD.netWidget.fetchJson(u); }
  function lang() { return (SD.i18n.current && SD.i18n.current()) || "en"; }
  function clampDays(cfg, max) { var n = Math.max(1, parseInt(cfg.forecastDays, 10) || 10); return max ? Math.min(n, max) : n; }
  function tConv(c, unit) { return c == null ? null : (unit === "fahrenheit" ? c * 9 / 5 + 32 : c); }
  // Inputs are km/h; convert to the user's chosen wind unit.
  function windConv(kmh, unit) {
    if (kmh == null) return null;
    if (unit === "ms") return kmh / 3.6;
    if (unit === "mph") return kmh / 1.609344;
    if (unit === "kn") return kmh / 1.852;
    return kmh;
  }

  // ---- condition-code mappers: each provider's code -> a representative WMO code (weather-icons buckets) ----
  function owmCode(id) {
    if (id === 800) return 0;
    if (id === 801 || id === 802) return 2;
    if (id === 803 || id === 804) return 3;
    if (id >= 200 && id < 300) return 95;
    if (id >= 300 && id < 400) return 51;
    if (id >= 500 && id < 600) return 63;
    if (id >= 600 && id < 700) return 71;
    if (id >= 700 && id < 800) return 45;
    return 3;
  }
  function waCode(c) {
    if (c === 1000) return 0;
    if (c === 1003) return 2;
    if (c === 1006 || c === 1009) return 3;
    if (c === 1030 || c === 1135 || c === 1147) return 45;
    if (c === 1087 || c === 1273 || c === 1276 || c === 1279 || c === 1282) return 95;
    if ([1066, 1069, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1237, 1255, 1258, 1261, 1264].indexOf(c) >= 0) return 71;
    if (c === 1150 || c === 1153 || c === 1168 || c === 1171 || c === 1063 || c === 1180 || c === 1183) return 51;
    if (c >= 1063) return 63;
    return 3;
  }
  function tioCode(c) {
    if (c === 1000) return 0;
    if (c === 1100 || c === 1101) return 2;
    if (c === 1102 || c === 1001) return 3;
    if (c === 2000 || c === 2100) return 45;
    if (c === 8000) return 95;
    if (c >= 5000 && c < 6000) return 71;
    if (c >= 7000 && c < 8000) return 71;
    if (c >= 4000 && c < 5000) return 63;
    if (c >= 6000 && c < 7000) return 63;
    return 3;
  }
  function awCode(n) {
    if ([1, 2, 5, 30, 33, 34, 37].indexOf(n) >= 0) return 0;
    if ([3, 4, 6, 35, 36, 38].indexOf(n) >= 0) return 2;
    if ([7, 8, 32].indexOf(n) >= 0) return 3;
    if (n === 11) return 45;
    if ([15, 16, 17, 41, 42].indexOf(n) >= 0) return 95;
    if ([19, 20, 21, 22, 23, 24, 25, 43, 44].indexOf(n) >= 0) return 71;
    if ([12, 13, 14, 18, 26, 29, 39, 40].indexOf(n) >= 0) return 63;
    return 3;
  }

  // ---- Open-Meteo (no key) ----
  function omUrl(cfg) {
    var p = ["latitude=" + enc(cfg.lat), "longitude=" + enc(cfg.lon), "timezone=auto"];
    var cur = ["temperature_2m", "weather_code", "is_day"];
    if (cfg.showHumidity !== false) cur.push("relative_humidity_2m");
    if (cfg.showWind !== false) cur.push("wind_speed_10m");
    p.push("current=" + cur.join(","));
    if (cfg.showHourly) p.push("hourly=temperature_2m,precipitation,precipitation_probability,weather_code");
    if (cfg.showForecast) p.push("daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max", "forecast_days=" + Math.max(1, Math.min(16, clampDays(cfg))));
    p.push("temperature_unit=" + enc(cfg.tempUnit || "celsius"), "wind_speed_unit=" + enc(cfg.windUnit || "kmh"));
    return "https://api.open-meteo.com/v1/forecast?" + p.join("&");
  }
  function omParse(json, cfg) {
    var c = json.current || {};
    var out = {
      temp: c.temperature_2m, code: c.weather_code, isDay: c.is_day == null ? 1 : c.is_day,
      humidity: c.relative_humidity_2m, wind: c.wind_speed_10m,
      tempUnit: cfg.tempUnit || "celsius", windUnit: cfg.windUnit || "kmh",
      place: cfg.place || "", tz: json.timezone || ""
    };
    if (json.hourly && json.hourly.time) {
      var h = json.hourly, now = Date.now(), arr = [];
      for (var i = 0; i < h.time.length && arr.length < 12; i++) {
        if (Date.parse(h.time[i]) < now - 3600000) continue;
        arr.push({ t: h.time[i], temp: h.temperature_2m[i], code: h.weather_code[i], precip: h.precipitation[i], pop: h.precipitation_probability[i] });
      }
      out.hourly = arr;
    }
    if (json.daily && json.daily.time) {
      var d = json.daily; out.daily = [];
      for (var j = 0; j < d.time.length; j++) out.daily.push({ date: d.time[j], code: d.weather_code[j], hi: d.temperature_2m_max[j], lo: d.temperature_2m_min[j], pop: d.precipitation_probability_max[j] });
    }
    return out;
  }

  // ---- OpenWeatherMap (current + 5day/3h forecast; metric, converted to user units) ----
  function owmFetch(cfg) {
    var k = provKey(cfg); if (!k) return Promise.reject(new Error("nokey"));
    var base = "https://api.openweathermap.org/data/2.5/";
    var q = "lat=" + enc(cfg.lat) + "&lon=" + enc(cfg.lon) + "&appid=" + enc(k) + "&units=metric&lang=" + enc(lang());
    var reqs = [fj(base + "weather?" + q)];
    reqs.push((cfg.showForecast || cfg.showHourly) ? fj(base + "forecast?" + q) : Promise.resolve(null));
    return Promise.all(reqs).then(function (r) {
      var cur = r[0] || {}, fc = r[1], w = (cur.weather && cur.weather[0]) || {}, main = cur.main || {};
      var out = {
        temp: tConv(main.temp, cfg.tempUnit), code: owmCode(w.id),
        isDay: /n$/.test(w.icon || "") ? 0 : 1, humidity: main.humidity != null ? main.humidity : null,
        wind: cur.wind ? windConv(cur.wind.speed * 3.6, cfg.windUnit) : null,
        tempUnit: cfg.tempUnit || "celsius", windUnit: cfg.windUnit || "kmh",
        place: cfg.place || cur.name || "", tz: ""
      };
      if (fc && fc.list) {
        var now = Date.now(), hourly = [], byDay = {};
        fc.list.forEach(function (it) {
          var tms = it.dt * 1000, m = it.main || {}, ic = (it.weather && it.weather[0]) || {};
          if (hourly.length < 12 && tms >= now - 3600000) hourly.push({ t: it.dt_txt.replace(" ", "T"), temp: tConv(m.temp, cfg.tempUnit), code: owmCode(ic.id), precip: (it.rain && it.rain["3h"]) || 0, pop: Math.round((it.pop || 0) * 100) });
          var day = it.dt_txt.slice(0, 10), b = byDay[day] || (byDay[day] = { hi: -1e9, lo: 1e9, pop: 0, code: null, noon: null });
          b.hi = Math.max(b.hi, m.temp_max); b.lo = Math.min(b.lo, m.temp_min); b.pop = Math.max(b.pop, Math.round((it.pop || 0) * 100));
          if (b.code == null) b.code = owmCode(ic.id);
          if (it.dt_txt.slice(11, 13) === "12") b.noon = owmCode(ic.id);
        });
        if (cfg.showHourly) out.hourly = hourly;
        if (cfg.showForecast) out.daily = Object.keys(byDay).sort().slice(0, clampDays(cfg)).map(function (d) { var b = byDay[d]; return { date: d, code: b.noon != null ? b.noon : b.code, hi: tConv(b.hi, cfg.tempUnit), lo: tConv(b.lo, cfg.tempUnit), pop: b.pop }; });
      }
      return out;
    });
  }

  // ---- WeatherAPI.com (single request: current + forecast + hourly) ----
  function waFetch(cfg) {
    var k = provKey(cfg); if (!k) return Promise.reject(new Error("nokey"));
    var u = "https://api.weatherapi.com/v1/forecast.json?key=" + enc(k) + "&q=" + enc(cfg.lat + "," + cfg.lon) + "&days=" + clampDays(cfg) + "&aqi=no&alerts=no&lang=" + enc(lang());
    return fj(u).then(function (j) {
      var cur = j.current || {}, loc = j.location || {}, cc = cur.condition || {};
      var out = {
        temp: tConv(cur.temp_c, cfg.tempUnit), code: waCode(cc.code),
        isDay: cur.is_day === 0 ? 0 : 1, humidity: cur.humidity != null ? cur.humidity : null,
        wind: cur.wind_kph != null ? windConv(cur.wind_kph, cfg.windUnit) : null,
        tempUnit: cfg.tempUnit || "celsius", windUnit: cfg.windUnit || "kmh",
        place: cfg.place || loc.name || "", tz: loc.tz_id || ""
      };
      var fdays = (j.forecast && j.forecast.forecastday) || [];
      if (cfg.showHourly) {
        var now = Date.now(), hh = [];
        fdays.forEach(function (fd) { (fd.hour || []).forEach(function (h) { if (hh.length < 12 && h.time_epoch * 1000 >= now - 3600000) hh.push({ t: h.time.replace(" ", "T"), temp: tConv(h.temp_c, cfg.tempUnit), code: waCode((h.condition || {}).code), precip: h.precip_mm || 0, pop: h.chance_of_rain != null ? h.chance_of_rain : null }); }); });
        out.hourly = hh;
      }
      if (cfg.showForecast) out.daily = fdays.map(function (fd) { var d = fd.day || {}; return { date: fd.date, code: waCode((d.condition || {}).code), hi: tConv(d.maxtemp_c, cfg.tempUnit), lo: tConv(d.mintemp_c, cfg.tempUnit), pop: d.daily_chance_of_rain != null ? d.daily_chance_of_rain : null }; });
      return out;
    });
  }

  // ---- Tomorrow.io (single forecast request; metric, derive current from first hourly step) ----
  function tioIsDay(h) { if (!h) return 1; var hr = new Date(h.time).getHours(); return hr >= 6 && hr < 20 ? 1 : 0; }
  function tioFetch(cfg) {
    var k = provKey(cfg); if (!k) return Promise.reject(new Error("nokey"));
    var u = "https://api.tomorrow.io/v4/weather/forecast?location=" + enc(cfg.lat + "," + cfg.lon) + "&apikey=" + enc(k) + "&units=metric&timesteps=1h&timesteps=1d";
    return fj(u).then(function (j) {
      var tl = j.timelines || {}, hours = tl.hourly || [], days = tl.daily || [], c0 = (hours[0] && hours[0].values) || {};
      var out = {
        temp: tConv(c0.temperature, cfg.tempUnit), code: tioCode(c0.weatherCode),
        isDay: tioIsDay(hours[0]), humidity: c0.humidity != null ? Math.round(c0.humidity) : null,
        wind: c0.windSpeed != null ? windConv(c0.windSpeed * 3.6, cfg.windUnit) : null,
        tempUnit: cfg.tempUnit || "celsius", windUnit: cfg.windUnit || "kmh",
        place: cfg.place || (j.location && j.location.name) || "", tz: ""
      };
      if (cfg.showHourly) {
        var now = Date.now(), hh = [];
        hours.forEach(function (h) { var tms = Date.parse(h.time), v = h.values || {}; if (hh.length < 12 && tms >= now - 3600000) hh.push({ t: h.time, temp: tConv(v.temperature, cfg.tempUnit), code: tioCode(v.weatherCode), precip: v.rainAccumulation || 0, pop: v.precipitationProbability != null ? Math.round(v.precipitationProbability) : null }); });
        out.hourly = hh;
      }
      if (cfg.showForecast) out.daily = days.slice(0, clampDays(cfg)).map(function (d) { var v = d.values || {}; var pop = v.precipitationProbabilityAvg != null ? v.precipitationProbabilityAvg : v.precipitationProbabilityMax; return { date: (d.time || "").slice(0, 10), code: tioCode(v.weatherCodeMax != null ? v.weatherCodeMax : v.weatherCode), hi: tConv(v.temperatureMax, cfg.tempUnit), lo: tConv(v.temperatureMin, cfg.tempUnit), pop: pop != null ? Math.round(pop) : null }; });
      return out;
    });
  }

  // ---- AccuWeather (location-key lookup -> current + daily/hourly; free tier: 5-day, 50 calls/day) ----
  var awKeys = {};   // lat,lon -> { key, name, tz } (cached for the session to save a geoposition call)
  function awFetch(cfg) {
    var k = provKey(cfg); if (!k) return Promise.reject(new Error("nokey"));
    var base = "https://dataservice.accuweather.com/", ll = cfg.lat + "," + cfg.lon, l = lang();
    var getKey = awKeys[ll] ? Promise.resolve(awKeys[ll]) : fj(base + "locations/v1/cities/geoposition/search?apikey=" + enc(k) + "&q=" + enc(ll) + "&language=" + enc(l)).then(function (loc) {
      awKeys[ll] = { key: loc.Key, name: loc.LocalizedName, tz: (loc.TimeZone && loc.TimeZone.Name) || "" };
      return awKeys[ll];
    });
    return getKey.then(function (info) {
      var reqs = [fj(base + "currentconditions/v1/" + enc(info.key) + "?apikey=" + enc(k) + "&details=true&language=" + enc(l))];
      reqs.push(cfg.showForecast ? fj(base + "forecasts/v1/daily/5day/" + enc(info.key) + "?apikey=" + enc(k) + "&metric=true&details=true&language=" + enc(l)) : Promise.resolve(null));
      reqs.push(cfg.showHourly ? fj(base + "forecasts/v1/hourly/12hour/" + enc(info.key) + "?apikey=" + enc(k) + "&metric=true&language=" + enc(l)) : Promise.resolve(null));
      return Promise.all(reqs).then(function (r) {
        var cur = (r[0] && r[0][0]) || {}, daily = r[1], hourly = r[2];
        var tm = cur.Temperature && cur.Temperature.Metric, wm = cur.Wind && cur.Wind.Speed && cur.Wind.Speed.Metric;
        var out = {
          temp: tConv(tm ? tm.Value : null, cfg.tempUnit), code: awCode(cur.WeatherIcon),
          isDay: cur.IsDayTime === false ? 0 : 1, humidity: cur.RelativeHumidity != null ? cur.RelativeHumidity : null,
          wind: wm ? windConv(wm.Value, cfg.windUnit) : null,
          tempUnit: cfg.tempUnit || "celsius", windUnit: cfg.windUnit || "kmh",
          place: cfg.place || info.name || "", tz: info.tz || ""
        };
        if (hourly) out.hourly = hourly.slice(0, 12).map(function (h) { return { t: h.DateTime, temp: tConv(h.Temperature ? h.Temperature.Value : null, cfg.tempUnit), code: awCode(h.WeatherIcon), precip: 0, pop: h.PrecipitationProbability != null ? h.PrecipitationProbability : null }; });
        if (daily && daily.DailyForecasts) out.daily = daily.DailyForecasts.slice(0, clampDays(cfg, 5)).map(function (d) { return { date: d.Date.slice(0, 10), code: awCode(d.Day && d.Day.Icon), hi: tConv(d.Temperature.Maximum.Value, cfg.tempUnit), lo: tConv(d.Temperature.Minimum.Value, cfg.tempUnit), pop: d.Day ? d.Day.PrecipitationProbability : null }; });
        return out;
      });
    });
  }

  function fetchData(cfg) {
    switch (cfg.provider) {
      case "accuweather": return awFetch(cfg);
      case "openweather": return owmFetch(cfg);
      case "weatherapi": return waFetch(cfg);
      case "tomorrow": return tioFetch(cfg);
      default: return fj(omUrl(cfg)).then(function (j) { return omParse(j, cfg); });
    }
  }

  // JS has no IANA-zone -> localized-city API, so map major zones; unknown zones fall back to the English name.
  var CITY_NAMES = {
    "Europe/Moscow": { en: "Moscow", ru: "Москва", cs: "Moskva", fr: "Moscou", de: "Moskau" },
    "Europe/Kaliningrad": { en: "Kaliningrad", ru: "Калининград" },
    "Europe/Samara": { en: "Samara", ru: "Самара" },
    "Asia/Yekaterinburg": { en: "Yekaterinburg", ru: "Екатеринбург" },
    "Asia/Omsk": { en: "Omsk", ru: "Омск" },
    "Asia/Novosibirsk": { en: "Novosibirsk", ru: "Новосибирск" },
    "Asia/Krasnoyarsk": { en: "Krasnoyarsk", ru: "Красноярск" },
    "Asia/Irkutsk": { en: "Irkutsk", ru: "Иркутск" },
    "Asia/Vladivostok": { en: "Vladivostok", ru: "Владивосток" },
    "Asia/Magadan": { en: "Magadan", ru: "Магадан" },
    "Europe/Minsk": { en: "Minsk", ru: "Минск", de: "Minsk" },
    "Europe/Kyiv": { en: "Kyiv", ru: "Киев", cs: "Kyjev", fr: "Kiev", de: "Kiew" },
    "Europe/Kiev": { en: "Kyiv", ru: "Киев", cs: "Kyjev", fr: "Kiev", de: "Kiew" },
    "Europe/London": { en: "London", ru: "Лондон", cs: "Londýn", fr: "Londres", de: "London" },
    "Europe/Paris": { en: "Paris", ru: "Париж", cs: "Paříž", fr: "Paris", de: "Paris" },
    "Europe/Berlin": { en: "Berlin", ru: "Берлин", cs: "Berlín", fr: "Berlin", de: "Berlin" },
    "Europe/Prague": { en: "Prague", ru: "Прага", cs: "Praha", fr: "Prague", de: "Prag" },
    "Europe/Madrid": { en: "Madrid", ru: "Мадрид", cs: "Madrid", fr: "Madrid", de: "Madrid" },
    "Europe/Rome": { en: "Rome", ru: "Рим", cs: "Řím", fr: "Rome", de: "Rom" },
    "Europe/Amsterdam": { en: "Amsterdam", ru: "Амстердам" },
    "Europe/Vienna": { en: "Vienna", ru: "Вена", cs: "Vídeň", fr: "Vienne", de: "Wien" },
    "Europe/Warsaw": { en: "Warsaw", ru: "Варшава", cs: "Varšava", fr: "Varsovie", de: "Warschau" },
    "Europe/Lisbon": { en: "Lisbon", ru: "Лиссабон", cs: "Lisabon", fr: "Lisbonne", de: "Lissabon" },
    "Europe/Athens": { en: "Athens", ru: "Афины", cs: "Atény", fr: "Athènes", de: "Athen" },
    "Europe/Istanbul": { en: "Istanbul", ru: "Стамбул", cs: "Istanbul", fr: "Istanbul", de: "Istanbul" },
    "Europe/Zurich": { en: "Zurich", ru: "Цюрих", cs: "Curych", fr: "Zurich", de: "Zürich" },
    "Europe/Stockholm": { en: "Stockholm", ru: "Стокгольм", cs: "Stockholm", fr: "Stockholm", de: "Stockholm" },
    "Europe/Brussels": { en: "Brussels", ru: "Брюссель", cs: "Brusel", fr: "Bruxelles", de: "Brüssel" },
    "Europe/Budapest": { en: "Budapest", ru: "Будапешт", cs: "Budapešť", fr: "Budapest", de: "Budapest" },
    "Europe/Bucharest": { en: "Bucharest", ru: "Бухарест", cs: "Bukurešť", fr: "Bucarest", de: "Bukarest" },
    "Europe/Dublin": { en: "Dublin", ru: "Дублин", cs: "Dublin", fr: "Dublin", de: "Dublin" },
    "America/New_York": { en: "New York", ru: "Нью-Йорк" },
    "America/Chicago": { en: "Chicago", ru: "Чикаго" },
    "America/Denver": { en: "Denver", ru: "Денвер" },
    "America/Los_Angeles": { en: "Los Angeles", ru: "Лос-Анджелес" },
    "America/Toronto": { en: "Toronto", ru: "Торонто" },
    "America/Mexico_City": { en: "Mexico City", ru: "Мехико", cs: "Ciudad de México", fr: "Mexico", de: "Mexiko-Stadt" },
    "America/Sao_Paulo": { en: "São Paulo", ru: "Сан-Паулу" },
    "America/Argentina/Buenos_Aires": { en: "Buenos Aires", ru: "Буэнос-Айрес" },
    "Asia/Tokyo": { en: "Tokyo", ru: "Токио", cs: "Tokio", fr: "Tokyo", de: "Tokio" },
    "Asia/Shanghai": { en: "Shanghai", ru: "Шанхай", de: "Schanghai" },
    "Asia/Hong_Kong": { en: "Hong Kong", ru: "Гонконг", fr: "Hong Kong", de: "Hongkong" },
    "Asia/Singapore": { en: "Singapore", ru: "Сингапур", fr: "Singapour", de: "Singapur" },
    "Asia/Seoul": { en: "Seoul", ru: "Сеул", cs: "Soul", fr: "Séoul", de: "Seoul" },
    "Asia/Dubai": { en: "Dubai", ru: "Дубай", cs: "Dubaj", fr: "Dubaï", de: "Dubai" },
    "Asia/Kolkata": { en: "Kolkata", ru: "Калькутта", de: "Kalkutta" },
    "Asia/Bangkok": { en: "Bangkok", ru: "Бангкок" },
    "Asia/Jakarta": { en: "Jakarta", ru: "Джакарта", de: "Jakarta" },
    "Asia/Tehran": { en: "Tehran", ru: "Тегеран", cs: "Teherán", fr: "Téhéran", de: "Teheran" },
    "Asia/Jerusalem": { en: "Jerusalem", ru: "Иерусалим", cs: "Jeruzalém", fr: "Jérusalem", de: "Jerusalem" },
    "Africa/Cairo": { en: "Cairo", ru: "Каир", cs: "Káhira", fr: "Le Caire", de: "Kairo" },
    "Africa/Johannesburg": { en: "Johannesburg", ru: "Йоханнесбург" },
    "Australia/Sydney": { en: "Sydney", ru: "Сидней" },
    "Australia/Melbourne": { en: "Melbourne", ru: "Мельбурн" },
    "Australia/Brisbane": { en: "Brisbane", ru: "Брисбен" },
    "Australia/Perth": { en: "Perth", ru: "Перт" },
    "Australia/Adelaide": { en: "Adelaide", ru: "Аделаида" },
    "Pacific/Auckland": { en: "Auckland", ru: "Окленд" },
    "Pacific/Honolulu": { en: "Honolulu", ru: "Гонолулу" },
    "Pacific/Guam": { en: "Guam", ru: "Гуам" },
    "Pacific/Port_Moresby": { en: "Port Moresby", ru: "Порт-Морсби" },
    "Asia/Yakutsk": { en: "Yakutsk", ru: "Якутск" },
    "Asia/Kamchatka": { en: "Petropavlovsk-Kamchatsky", ru: "Петропавловск-Камчатский" },
    "Asia/Sakhalin": { en: "Yuzhno-Sakhalinsk", ru: "Южно-Сахалинск" },
    "Asia/Chita": { en: "Chita", ru: "Чита" },
    "Asia/Barnaul": { en: "Barnaul", ru: "Барнаул" },
    "Asia/Tomsk": { en: "Tomsk", ru: "Томск" },
    "Asia/Anadyr": { en: "Anadyr", ru: "Анадырь" },
    "Europe/Volgograd": { en: "Volgograd", ru: "Волгоград" },
    "Europe/Saratov": { en: "Saratov", ru: "Саратов" },
    "Europe/Astrakhan": { en: "Astrakhan", ru: "Астрахань" },
    "Europe/Ulyanovsk": { en: "Ulyanovsk", ru: "Ульяновск" },
    "Europe/Kirov": { en: "Kirov", ru: "Киров" },
    "Asia/Almaty": { en: "Almaty", ru: "Алматы" },
    "Asia/Tashkent": { en: "Tashkent", ru: "Ташкент", de: "Taschkent" },
    "Asia/Tbilisi": { en: "Tbilisi", ru: "Тбилиси", de: "Tiflis" },
    "Asia/Yerevan": { en: "Yerevan", ru: "Ереван", de: "Eriwan" },
    "Asia/Baku": { en: "Baku", ru: "Баку" },
    "Asia/Bishkek": { en: "Bishkek", ru: "Бишкек", de: "Bischkek" },
    "Asia/Dushanbe": { en: "Dushanbe", ru: "Душанбе", de: "Duschanbe" },
    "Asia/Ashgabat": { en: "Ashgabat", ru: "Ашхабад", de: "Aschgabat" },
    "Europe/Chisinau": { en: "Chisinau", ru: "Кишинёв" },
    "Europe/Riga": { en: "Riga", ru: "Рига" },
    "Europe/Vilnius": { en: "Vilnius", ru: "Вильнюс" },
    "Europe/Tallinn": { en: "Tallinn", ru: "Таллин" },
    "Europe/Helsinki": { en: "Helsinki", ru: "Хельсинки" },
    "Europe/Oslo": { en: "Oslo", ru: "Осло" },
    "Europe/Copenhagen": { en: "Copenhagen", ru: "Копенгаген", cs: "Kodaň", fr: "Copenhague", de: "Kopenhagen" },
    "Europe/Zagreb": { en: "Zagreb", ru: "Загреб" },
    "Europe/Belgrade": { en: "Belgrade", ru: "Белград", cs: "Bělehrad", fr: "Belgrade", de: "Belgrad" },
    "Europe/Sofia": { en: "Sofia", ru: "София" },
    "Europe/Bratislava": { en: "Bratislava", ru: "Братислава" },
    "Europe/Ljubljana": { en: "Ljubljana", ru: "Любляна", cs: "Lublaň" },
    "Europe/Sarajevo": { en: "Sarajevo", ru: "Сараево" },
    "Europe/Skopje": { en: "Skopje", ru: "Скопье" },
    "Europe/Tirane": { en: "Tirana", ru: "Тирана" },
    "Europe/Luxembourg": { en: "Luxembourg", ru: "Люксембург", de: "Luxemburg" },
    "Europe/Monaco": { en: "Monaco", ru: "Монако" },
    "Europe/Reykjavik": { en: "Reykjavik", ru: "Рейкьявик" },
    "America/Vancouver": { en: "Vancouver", ru: "Ванкувер" },
    "America/Edmonton": { en: "Edmonton", ru: "Эдмонтон" },
    "America/Winnipeg": { en: "Winnipeg", ru: "Виннипег" },
    "America/Halifax": { en: "Halifax", ru: "Галифакс" },
    "America/Phoenix": { en: "Phoenix", ru: "Финикс" },
    "America/Anchorage": { en: "Anchorage", ru: "Анкоридж" },
    "America/Bogota": { en: "Bogotá", ru: "Богота" },
    "America/Lima": { en: "Lima", ru: "Лима" },
    "America/Santiago": { en: "Santiago", ru: "Сантьяго" },
    "America/Caracas": { en: "Caracas", ru: "Каракас" },
    "America/Havana": { en: "Havana", ru: "Гавана", cs: "Havana", fr: "La Havane", de: "Havanna" },
    "America/Panama": { en: "Panama City", ru: "Панама", fr: "Panama", de: "Panama-Stadt" },
    "America/Montevideo": { en: "Montevideo", ru: "Монтевидео" },
    "America/Manaus": { en: "Manaus", ru: "Манаус" },
    "America/Guayaquil": { en: "Guayaquil", ru: "Гуаякиль" },
    "America/Asuncion": { en: "Asunción", ru: "Асунсьон" },
    "America/La_Paz": { en: "La Paz", ru: "Ла-Пас" },
    "America/Santo_Domingo": { en: "Santo Domingo", ru: "Санто-Доминго" },
    "Asia/Kuala_Lumpur": { en: "Kuala Lumpur", ru: "Куала-Лумпур" },
    "Asia/Manila": { en: "Manila", ru: "Манила" },
    "Asia/Ho_Chi_Minh": { en: "Ho Chi Minh City", ru: "Хошимин", fr: "Hô Chi Minh-Ville", de: "Ho-Chi-Minh-Stadt" },
    "Asia/Taipei": { en: "Taipei", ru: "Тайбэй", de: "Taipeh" },
    "Asia/Karachi": { en: "Karachi", ru: "Карачи", de: "Karatschi" },
    "Asia/Dhaka": { en: "Dhaka", ru: "Дакка" },
    "Asia/Colombo": { en: "Colombo", ru: "Коломбо" },
    "Asia/Kathmandu": { en: "Kathmandu", ru: "Катманду" },
    "Asia/Yangon": { en: "Yangon", ru: "Янгон" },
    "Asia/Phnom_Penh": { en: "Phnom Penh", ru: "Пномпень" },
    "Asia/Riyadh": { en: "Riyadh", ru: "Эр-Рияд", cs: "Rijád", fr: "Riyad", de: "Riad" },
    "Asia/Baghdad": { en: "Baghdad", ru: "Багдад", cs: "Bagdád", fr: "Bagdad", de: "Bagdad" },
    "Asia/Kuwait": { en: "Kuwait City", ru: "Эль-Кувейт", de: "Kuwait-Stadt" },
    "Asia/Qatar": { en: "Doha", ru: "Доха" },
    "Asia/Beirut": { en: "Beirut", ru: "Бейрут", cs: "Bejrút", fr: "Beyrouth", de: "Beirut" },
    "Asia/Damascus": { en: "Damascus", ru: "Дамаск", cs: "Damašek", fr: "Damas", de: "Damaskus" },
    "Asia/Amman": { en: "Amman", ru: "Амман" },
    "Asia/Muscat": { en: "Muscat", ru: "Маскат", fr: "Mascate", de: "Maskat" },
    "Asia/Kabul": { en: "Kabul", ru: "Кабул" },
    "Asia/Ulaanbaatar": { en: "Ulaanbaatar", ru: "Улан-Батор" },
    "Asia/Macau": { en: "Macau", ru: "Макао" },
    "Africa/Lagos": { en: "Lagos", ru: "Лагос" },
    "Africa/Nairobi": { en: "Nairobi", ru: "Найроби" },
    "Africa/Casablanca": { en: "Casablanca", ru: "Касабланка" },
    "Africa/Algiers": { en: "Algiers", ru: "Алжир", cs: "Alžír", fr: "Alger", de: "Algier" },
    "Africa/Tunis": { en: "Tunis", ru: "Тунис" },
    "Africa/Accra": { en: "Accra", ru: "Аккра" },
    "Africa/Addis_Ababa": { en: "Addis Ababa", ru: "Аддис-Абеба", de: "Addis Abeba" },
    "Africa/Khartoum": { en: "Khartoum", ru: "Хартум", de: "Khartum" },
    "Africa/Tripoli": { en: "Tripoli", ru: "Триполи", cs: "Tripolis", fr: "Tripoli", de: "Tripolis" },
    "Africa/Dakar": { en: "Dakar", ru: "Дакар" }
  };

  function localizedCity(tz, locale) {
    if (!tz) return "";
    var e = CITY_NAMES[tz];
    if (e) return e[locale] || e.en || cityFromTz(tz);
    return cityFromTz(tz);
  }
  function cityFromTz(tz) { if (!tz) return ""; var p = String(tz).split("/"); return (p[p.length - 1] || "").replace(/_/g, " "); }

  function icon(code, isDay, size) { return SD.weatherIcons ? SD.weatherIcons.el(code, isDay, size) : document.createElementNS("http://www.w3.org/2000/svg", "svg"); }
  function condText(d, ctx) { return SD.weatherIcons ? ctx.i18n.t("weather.cond." + SD.weatherIcons.group(d.code)) : ""; }
  function tempStr(d) { return (d.temp != null) ? Math.round(d.temp) + "°" : "—"; }

  function metaRow(d, ctx) {
    var D = ctx.dom, parts = [];
    if (d.humidity != null) parts.push(D.el("span", { class: "w-meta-item", text: ctx.i18n.t("weather.humidity") + " " + Math.round(d.humidity) + "%" }));
    if (d.wind != null) parts.push(D.el("span", { class: "w-meta-item", text: ctx.i18n.t("weather.wind") + " " + Math.round(d.wind) + " " + ctx.i18n.t("weather.wind" + capUnit(d.windUnit)) }));
    return parts.length ? D.el("div", { class: "w-meta" }, parts) : null;
  }
  function capUnit(u) { return ({ kmh: "Kmh", ms: "Ms", mph: "Mph", kn: "Kn" })[u] || "Kmh"; }

  function hourlyStrip(d, ctx) {
    var D = ctx.dom;
    if (!d.hourly || !d.hourly.length) return null;
    var strip = D.el("div", { class: "w-hourly" });
    d.hourly.forEach(function (h) {
      var col = D.el("div", { class: "w-hour" }, [
        D.el("span", { class: "w-hour-t", text: new Date(h.t).getHours() + "h" })
      ]);
      col.appendChild(icon(h.code, 1, 22));
      col.appendChild(D.el("span", { class: "w-hour-temp", text: Math.round(h.temp) + "°" }));
      if (h.pop != null && h.pop > 0) col.appendChild(D.el("span", { class: "w-pop", text: h.pop + "%" }));
      strip.appendChild(col);
    });
    return strip;
  }

  function forecastRow(d, ctx) {
    var D = ctx.dom;
    if (!d.daily || !d.daily.length) return null;
    var wrap = ctx.cfg().forecastWrap !== false ? "wrap" : "scroll";
    var row = D.el("div", { class: "w-forecast " + wrap });
    d.daily.forEach(function (day) {
      var dow = new Date(day.date + "T00:00").toLocaleDateString(ctx.i18n.current(), { weekday: "short" });
      var tile = D.el("div", { class: "w-day" }, [D.el("span", { class: "w-dow", text: dow })]);
      tile.appendChild(icon(day.code, 1, 26));
      tile.appendChild(D.el("span", { class: "w-hilo", text: Math.round(day.hi) + "°/" + Math.round(day.lo) + "°" }));
      row.appendChild(tile);
    });
    return row;
  }

  function radarBtn(ctx) {
    var b = ctx.dom.el("button", { class: "btn ghost w-radar-btn", text: "🗺 " + ctx.i18n.t("weather.radarOpen") });
    b.addEventListener("click", function () { if (SD.radar) SD.radar.open(ctx.cfg(), ctx); });
    return b;
  }

  function render(el, res, ctx) {
    var D = ctx.dom; D.clear(el);
    if (res.error && !res.data) { el.appendChild(D.el("div", { class: "w-err", text: ctx.i18n.t("status.error") })); return; }
    var d = res.data || {}, cfg = ctx.cfg();
    var place = d.place || localizedCity(d.tz, ctx.i18n.current());
    el.setAttribute("data-style", cfg.style || "minimal");
    if ((cfg.style || "minimal") === "htc") renderHtc(el, d, place, ctx);
    else if (cfg.style === "compact") renderCompact(el, d, place, ctx);
    else renderMinimal(el, d, place, ctx);   // minimal & detailed share the base layout
    var strip = hourlyStrip(d, ctx); if (strip) el.appendChild(strip);
    var fc = forecastRow(d, ctx); if (fc) el.appendChild(fc);
    if (cfg.radarEnabled) el.appendChild(radarBtn(ctx));
    if (res.fromCache) el.appendChild(D.el("span", { class: "w-cache", text: ctx.i18n.t("status.cached") }));
  }

  function renderMinimal(el, d, place, ctx) {
    var D = ctx.dom;
    if (place) el.appendChild(D.el("div", { class: "w-place", text: place }));
    var head = D.el("div", { class: "w-head" });
    head.appendChild(icon(d.code, d.isDay, 30));
    head.appendChild(D.el("span", { class: "w-temp", text: tempStr(d) }));
    el.appendChild(head);
    var m = metaRow(d, ctx); if (m) el.appendChild(m);
  }
  function renderCompact(el, d, place, ctx) {
    var D = ctx.dom;
    var line = D.el("div", { class: "w-compact" });
    line.appendChild(icon(d.code, d.isDay, 22));
    line.appendChild(D.el("span", { class: "w-temp", text: tempStr(d) }));
    if (place) line.appendChild(D.el("span", { class: "w-place", text: place }));
    el.appendChild(line);
  }
  function renderHtc(el, d, place, ctx) {
    var D = ctx.dom;
    el.setAttribute("data-cond", SD.weatherIcons ? SD.weatherIcons.group(d.code) : "");
    el.setAttribute("data-night", d.isDay ? "0" : "1");
    var hero = D.el("div", { class: "w-htc" });
    hero.appendChild(icon(d.code, d.isDay, 64));
    hero.appendChild(D.el("div", { class: "w-htc-temp", text: tempStr(d) }));
    if (place) hero.appendChild(D.el("div", { class: "w-htc-place", text: place }));
    hero.appendChild(D.el("div", { class: "w-htc-cond", text: condText(d, ctx) }));
    var m = metaRow(d, ctx); if (m) hero.appendChild(m);
    el.appendChild(hero);
  }

  // clearCache=true drops cached data so the next render refetches
  function setW(ctx, mut, clearCache) { ctx.commitCfg(mut); if (clearCache) ctx.cache.set(null); }

  function renderSettings(el, ctx) {
    var c = ctx.controls, t = ctx.i18n.t, cfg = ctx.cfg();
    function redraw() { ctx.dom.clear(el); renderSettings(el, ctx); }
    el.appendChild(c.row(t("provider.label"), c.sel(PROVIDERS, cfg.provider, function (v) { setW(ctx, function (x) { x.provider = v; }, true); redraw(); })));
    if (needsKey(cfg.provider)) {
      el.appendChild(c.row(t("weather.apiKey"), c.text((cfg.keys && cfg.keys[cfg.provider]) || "", function (v) { setW(ctx, function (x) { x.keys = x.keys || {}; x.keys[cfg.provider] = (v || "").trim(); }, true); })));
      var help = ctx.dom.el("a", { "class": "w-key-help", href: KEY_URLS[cfg.provider], target: "_blank", rel: "noopener noreferrer", text: t("weather.getKey") });
      el.appendChild(c.row("", help));
    }
    el.appendChild(c.row(t("provider.coords"), c.pair(
      c.num(cfg.lat, -90, 90, 0.01, function (v) { setW(ctx, function (x) { x.lat = v; }, true); }),
      c.num(cfg.lon, -180, 180, 0.01, function (v) { setW(ctx, function (x) { x.lon = v; }, true); }))));
    el.appendChild(c.row(t("provider.place"), c.text(cfg.place || "", function (v) { setW(ctx, function (x) { x.place = v; }); })));
    el.appendChild(c.row(t("weather.style"), c.sel([
      ["minimal", t("weather.styleMinimal")], ["htc", t("weather.styleHtc")], ["compact", t("weather.styleCompact")]
    ], cfg.style || "minimal", function (v) { setW(ctx, function (x) { x.style = v; }); })));
    el.appendChild(c.row(t("weather.tempUnit"), c.sel([["celsius", t("weather.unitC")], ["fahrenheit", t("weather.unitF")]], cfg.tempUnit || "celsius", function (v) { setW(ctx, function (x) { x.tempUnit = v; }, true); })));
    el.appendChild(c.row(t("weather.windUnit"), c.sel([["kmh", t("weather.windKmh")], ["ms", t("weather.windMs")], ["mph", t("weather.windMph")], ["kn", t("weather.windKn")]], cfg.windUnit || "kmh", function (v) { setW(ctx, function (x) { x.windUnit = v; }, true); })));
    el.appendChild(c.row(t("weather.showHumidity"), c.check(cfg.showHumidity !== false, function (v) { setW(ctx, function (x) { x.showHumidity = v; }, true); })));
    el.appendChild(c.row(t("weather.showWind"), c.check(cfg.showWind !== false, function (v) { setW(ctx, function (x) { x.showWind = v; }, true); })));
    el.appendChild(c.row(t("weather.showHourly"), c.check(!!cfg.showHourly, function (v) { setW(ctx, function (x) { x.showHourly = v; }, true); })));
    el.appendChild(c.row(t("weather.showForecast"), c.check(!!cfg.showForecast, function (v) { setW(ctx, function (x) { x.showForecast = v; }, true); redraw(); })));
    if (cfg.showForecast) {
      el.appendChild(c.row(t("weather.forecastDays"), c.num(cfg.forecastDays || 10, 3, 15, 1, function (v) { setW(ctx, function (x) { x.forecastDays = Math.max(3, Math.min(15, v || 10)); }, true); })));
      el.appendChild(c.row(t("weather.forecastWrap"), c.check(cfg.forecastWrap !== false, function (v) { setW(ctx, function (x) { x.forecastWrap = v; }); })));
    }
    var radarCb = c.check(!!cfg.radarEnabled, function (v) {
      if (!v) { setW(ctx, function (x) { x.radarEnabled = false; }); return; }
      enableRadar(ctx).then(function (ok) { if (ok) setW(ctx, function (x) { x.radarEnabled = true; }); else radarCb.checked = false; });
    });
    el.appendChild(c.row(t("weather.radarEnable"), radarCb));
  }

  // The radar uses Open-Meteo (same provider as weather). Consent + host permission, one gesture.
  async function enableRadar(ctx) {
    var st = SD.store.get();
    if (!st.consents || !st.consents["w-weather-radar"]) {
      var ok = await SD.ui.privacyConsent("api.open-meteo.com", SD.i18n.t("privacy.dataRadar"));
      if (!ok) return false;
      SD.store.commit(function (s) { (s.consents = s.consents || {})["w-weather-radar"] = true; });
    }
    if (!SD.has("permissions.request")) return true;
    try {
      return await SD.api.permissions.request({ origins: ["https://api.open-meteo.com/*"] });
    } catch (e) { return true; }
  }

  // Language-aware location + units (only the US uses °F/mph). Read once at widget creation.
  function localeDefaults() {
    var l = (SD.i18n.current && SD.i18n.current()) || "en", region = "";
    try { region = ((SD.api.i18n && SD.api.i18n.getUILanguage && SD.api.i18n.getUILanguage()) || "").split("-")[1] || ""; } catch (e) { region = ""; }
    var loc = { ru: { lat: 55.75, lon: 37.62, place: "Москва" }, de: { lat: 52.52, lon: 13.405, place: "Berlin" }, fr: { lat: 48.857, lon: 2.352, place: "Paris" }, cs: { lat: 50.088, lon: 14.42, place: "Praha" } }[l];
    if (!loc) loc = region === "GB" ? { lat: 51.507, lon: -0.128, place: "London" } : { lat: 40.71, lon: -74.0, place: "New York" };
    var f = region === "US";
    return { lat: loc.lat, lon: loc.lon, place: loc.place, tempUnit: f ? "fahrenheit" : "celsius", windUnit: f ? "mph" : "kmh" };
  }
  function defaultConfig() {
    var d = localeDefaults();
    return {
      provider: "open-meteo", keys: {}, lat: d.lat, lon: d.lon, place: "",
      tempUnit: d.tempUnit, windUnit: d.windUnit, style: "minimal",
      showHumidity: true, showWind: true, showHourly: false, showForecast: true, forecastDays: 10, forecastWrap: true, radarEnabled: false, radarTiles: "none", radarSource: "openmeteo", radarDetail: "med"
    };
  }

  SD.registry.register({
    id: "weather", kind: "net", titleKey: "widget.weather", order: 50,
    providers: PROVIDERS, ttlMin: 30, privacyDataKey: "privacy.dataCoords",
    origin: origin, fetchData: fetchData, render: render, renderSettings: renderSettings, defaultConfig: defaultConfig
  });
})();
