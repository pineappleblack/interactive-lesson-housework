/* Самостоятельная версия графика: Matter.js отвечает за физику, D3 — за точки в SVG. */
(() => {
  'use strict';

  const { Bodies, Body, Composite, Engine } = Matter;
  const GIRL_DOTS = 78;
  const DAD_DOTS = 44; // 218,8 минуты из таблицы 2.4 Росстата → 43,8 шарика.
  const DAD_MINUTES = 220; // Ответ сверяем с 44 шариками по 5 минут; это положение доступно на ползунке.
  const MINUTES_PER_DOT = 5;
  const MAX_DOTS = 144;
  const GIRL_COLOR = '#645D9F';
  const DAD_COLOR = '#25868B';
  const ACTIVE = 0x0001;
  const WALL = 0x0002;
  const FALLING = 0x0004;
  const svg = document.getElementById('chart');
  const slider = document.getElementById('guess');
  const sliderValue = document.getElementById('guess-value');
  const checkButton = document.getElementById('check');
  const result = document.getElementById('result');
  const control = document.getElementById('control');
  const girlValue = document.getElementById('girl-value');
  const dadValue = document.getElementById('dad-value');
  const compactMedia = window.matchMedia('(max-width: 520px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { started: false, guess: 0, touched: false, checked: false, submitted: 0, world: null };

  function formatMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} ч ${rest} мин` : `${hours} ч`;
  }

  function geometry() {
    return compactMedia.matches
      ? { width: 360, height: 280, baseline: 222, radius: 5.4, girlX: 87, dadX: 273, binWidth: 118 }
      : { width: 680, height: 290, baseline: 226, radius: 6.2, girlX: 180, dadX: 500, binWidth: 142 };
  }

  function setAttributes(id, attributes) {
    const node = document.getElementById(id);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  }

  function layout(g) {
    svg.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`);
    setAttributes('pile-clip-rect', { x: 0, y: 0, width: g.width, height: g.baseline });
    setAttributes('baseline', {
      x1: g.girlX - g.binWidth / 2, x2: g.dadX + g.binWidth / 2,
      y1: g.baseline, y2: g.baseline,
    });
    setAttributes('legend-dot', { cx: g.radius + 2, cy: 15, r: g.radius });
    setAttributes('legend-label', { x: g.radius * 2 + 9, y: 19 });
    setAttributes('girl-value', { x: g.girlX, y: 38 });
    setAttributes('dad-value', { x: g.dadX, y: 38 });
    for (const [id, x, y] of [
      ['girl-label-1', g.girlX, g.baseline + 26],
      ['girl-label-2', g.girlX, g.baseline + 44],
      ['dad-label-1', g.dadX, g.baseline + 26],
      ['dad-label-2', g.dadX, g.baseline + 44],
    ]) setAttributes(id, { x, y });
  }

  function addBin(engine, centreX, g) {
    const wall = (x, y, width, height) => Bodies.rectangle(x, y, width, height, {
      isStatic: true,
      friction: 0.8,
      collisionFilter: { category: WALL, mask: ACTIVE | FALLING },
    });
    Composite.add(engine.world, [
      wall(centreX, g.baseline + 10, g.binWidth + 44, 20),
      wall(centreX - g.binWidth / 2 - 10, (g.baseline - 60) / 2, 20, g.baseline + 60),
      wall(centreX + g.binWidth / 2 + 10, (g.baseline - 60) / 2, 20, g.baseline + 60),
      wall(centreX, -30, g.binWidth + 44, 20),
    ]);
  }

  function createApple(world, kind, index, status = 'ordinary') {
    const g = world.geometry;
    const centreX = kind === 'girl' ? g.girlX : g.dadX;
    const body = Bodies.circle(centreX, 18, g.radius, {
      restitution: 0.16,
      friction: 0.65,
      frictionStatic: 0.9,
      frictionAir: 0.012,
      sleepThreshold: 35,
      slop: 0.01,
      collisionFilter: { category: FALLING, mask: WALL },
    });
    world.queue.push({ id: `${kind}-${index}`, body, kind, status, airborne: true });
  }

  function draw(world, kind) {
    const dots = world.apples.filter((apple) => apple.kind === kind);
    d3.select(`#${kind}-dots`).selectAll('circle')
      .data(dots, (apple) => apple.id)
      .join('circle')
      .attr('r', world.geometry.radius)
      .attr('fill', (apple) => apple.status === 'extra' ? '#fff' : apple.status === 'missing' ? '#E9A72E' : kind === 'girl' ? GIRL_COLOR : DAD_COLOR)
      .attr('stroke', (apple) => apple.status === 'extra' ? DAD_COLOR : 'none')
      .attr('stroke-width', (apple) => apple.status === 'extra' ? 1.5 : 0)
      .attr('cx', (apple) => apple.body.position.x)
      .attr('cy', (apple) => apple.body.position.y);
  }

  function tick(world, time) {
    if (state.world !== world) return;
    const { geometry: g, engine } = world;
    if (world.queue.length && (reducedMotion.matches || time - world.lastDrop > 55)) {
      for (let released = 0; released < 3 && world.queue.length; released += 1) {
        const alternate = world.queue.findIndex((apple) => apple.kind !== world.lastKind);
        const apple = world.queue.splice(alternate < 0 ? 0 : alternate, 1)[0];
        const x = apple.kind === 'girl' ? g.girlX : g.dadX;
        const pitch = g.radius * 2 + 2;
        const lanes = Math.floor((g.binWidth - g.radius * 3) / pitch) + 1;
        const lane = (Number(apple.id.split('-')[1]) * 5) % lanes;
        Body.setPosition(apple.body, { x: x - ((lanes - 1) * pitch) / 2 + lane * pitch, y: 18 });
        Body.setVelocity(apple.body, { x: 0, y: 0 });
        Composite.add(engine.world, apple.body);
        world.apples.push(apple);
        world.lastKind = apple.kind;
      }
      world.lastDrop = time;
      world.dirty = true;
    }

    const moving = world.apples.some((apple) => !apple.body.isSleeping);
    if (moving) Engine.update(engine, 1000 / 60);
    for (const kind of ['girl', 'dad']) {
      if (!world.apples.some((apple) => apple.kind === kind && apple.airborne)) continue;
      const active = world.apples.filter((apple) => apple.kind === kind && !apple.airborne);
      const top = active.length ? Math.min(...active.map((apple) => apple.body.position.y)) : g.baseline;
      for (const apple of world.apples) {
        if (apple.kind !== kind || !apple.airborne || apple.body.position.y < top - g.radius * 2.5) continue;
        apple.body.collisionFilter.category = ACTIVE;
        apple.body.collisionFilter.mask = ACTIVE | WALL;
        apple.airborne = false;
      }
    }
    for (const apple of world.apples) {
      const centreX = apple.kind === 'girl' ? g.girlX : g.dadX;
      const { x, y } = apple.body.position;
      if (x < centreX - g.binWidth / 2 || x > centreX + g.binWidth / 2 || y < -4 || y > g.baseline + 4) {
        Body.setPosition(apple.body, {
          x: Math.max(centreX - g.binWidth / 2 + g.radius, Math.min(centreX + g.binWidth / 2 - g.radius, x)),
          y: Math.max(g.radius, Math.min(g.baseline - g.radius, y)),
        });
        Body.setVelocity(apple.body, { x: 0, y: 0 });
        world.dirty = true;
      }
    }
    if (moving || world.dirty) {
      draw(world, 'girl');
      draw(world, 'dad');
      world.dirty = false;
    }
    const girls = world.apples.filter((apple) => apple.kind === 'girl');
    if (girls.length === GIRL_DOTS && !world.queue.some((apple) => apple.kind === 'girl')) {
      world.girlFinishedAt ??= time;
      if (girls.every((apple) => apple.body.isSleeping) && time - world.girlFinishedAt > 350) girlValue.classList.add('visible');
    }
    if (state.checked && !world.queue.some((apple) => apple.kind === 'dad')) dadValue.classList.add('visible');
    world.frame = requestAnimationFrame((nextTime) => tick(world, nextTime));
  }

  function startWorld() {
    if (state.world) {
      cancelAnimationFrame(state.world.frame);
      Composite.clear(state.world.engine.world, false);
      Engine.clear(state.world.engine);
    }
    d3.select('#girl-dots').selectAll('circle').remove();
    d3.select('#dad-dots').selectAll('circle').remove();
    girlValue.classList.remove('visible');
    dadValue.classList.remove('visible');
    const g = geometry();
    layout(g);
    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.y = 1.05;
    engine.positionIterations = 6;
    engine.velocityIterations = 4;
    addBin(engine, g.girlX, g);
    addBin(engine, g.dadX, g);
    const world = { engine, geometry: g, apples: [], queue: [], frame: 0, lastDrop: 0, lastKind: null, dirty: true, girlFinishedAt: null };
    state.world = world;
    for (let index = 0; index < GIRL_DOTS; index += 1) createApple(world, 'girl', index);
    const dadCount = state.checked ? Math.max(DAD_DOTS, state.submitted) : state.guess;
    for (let index = 0; index < dadCount; index += 1) {
      const status = !state.checked ? 'ordinary' : index >= DAD_DOTS ? 'extra' : index >= state.submitted ? 'missing' : 'ordinary';
      createApple(world, 'dad', index, status);
    }
    world.frame = requestAnimationFrame((time) => tick(world, time));
  }

  function updateGuess(next) {
    state.guess = next;
    state.touched = true;
    sliderValue.textContent = formatMinutes(next * MINUTES_PER_DOT);
    slider.setAttribute('aria-valuetext', sliderValue.textContent);
    slider.style.setProperty('--progress', `${next / MAX_DOTS * 100}%`);
    checkButton.disabled = false;
    const world = state.world;
    if (!world) return;
    const existing = new Set([...world.apples, ...world.queue]
      .filter((apple) => apple.kind === 'dad').map((apple) => apple.id));
    for (let index = 0; index < next; index += 1) {
      if (!existing.has(`dad-${index}`)) createApple(world, 'dad', index);
    }
    world.queue = world.queue.filter((apple) => apple.kind !== 'dad' || Number(apple.id.split('-')[1]) < next);
    for (const apple of world.apples.filter((item) => item.kind === 'dad' && Number(item.id.split('-')[1]) >= next)) {
      Composite.remove(world.engine.world, apple.body);
      world.apples = world.apples.filter((item) => item !== apple);
    }
    world.dirty = true;
  }

  function paragraph(className, content) {
    const node = document.createElement('p');
    if (className) node.className = className;
    node.textContent = content;
    return node;
  }

  function reveal() {
    if (!state.touched || state.checked) return;
    state.submitted = state.guess;
    state.checked = true;
    control.hidden = true;
    result.hidden = false;
    const answer = state.submitted;
    const guessedMinutes = answer * MINUTES_PER_DOT;
    const difference = Math.abs(guessedMinutes - DAD_MINUTES);
    const errorDots = Math.abs(answer - DAD_DOTS);
    const relation = guessedMinutes > DAD_MINUTES ? 'больше' : 'меньше';
    result.append(paragraph('', `Вы предположили ${formatMinutes(guessedMinutes)}. У папы — 3,6 часа.`));
    result.append(paragraph('error', difference === 0 ? 'Вы угадали.' : `Ошибка — ${formatMinutes(difference)} ${relation}.`));
    if (errorDots > 0) {
      const key = paragraph('error-key', `${answer > DAD_DOTS ? 'Светлый контур — лишние шарики' : 'Жёлтые шарики — недостающие'} (${errorDots} шт.)`);
      const dot = document.createElement('span');
      dot.className = `error-dot ${answer > DAD_DOTS ? 'extra' : 'missing'}`;
      key.prepend(dot);
      result.append(key);
    }
    const world = state.world;
    if (!world) return;
    if (answer < DAD_DOTS) {
      for (let index = answer; index < DAD_DOTS; index += 1) createApple(world, 'dad', index, 'missing');
    } else if (answer > DAD_DOTS) {
      for (const apple of [...world.apples, ...world.queue]) {
        if (apple.kind === 'dad' && Number(apple.id.split('-')[1]) >= DAD_DOTS) apple.status = 'extra';
      }
      world.dirty = true;
    }
    if (answer >= DAD_DOTS) dadValue.classList.add('visible');
  }

  slider.addEventListener('input', () => updateGuess(Number(slider.value)));
  checkButton.addEventListener('click', reveal);
  compactMedia.addEventListener('change', () => { if (state.started) startWorld(); else layout(geometry()); });
  layout(geometry());
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      state.started = true;
      startWorld();
    }, { threshold: 0.2 });
    observer.observe(document.querySelector('.figure'));
    setTimeout(() => { if (!state.started) { observer.disconnect(); state.started = true; startWorld(); } }, 3500);
  } else {
    state.started = true;
    startWorld();
  }
})();
