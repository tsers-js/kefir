import Kefir from "kefir"

function KefirAdapter(obs) {
  this.o = obs
}

function KefirBus() {
  this.s = Kefir.stream(emitter => {
    this.e = emitter
    return () => this.e = void 0
  })
}

Object.assign(KefirAdapter.prototype, {
  get() {
    return this.o
  },
  getp() {
    return this.o.toProperty()
  },
  multicast() {
    return new KefirAdapter(this.o)
  },
  map(fn) {
    return new KefirAdapter(this.o.map(fn))
  },
  tap(fn) {
    return new KefirAdapter(this.o.map(x => (fn() || true) && x))
  },
  filter(fn) {
    return new KefirAdapter(this.o.filter(fn))
  },
  doOnCompleted(fn) {
    const val = {}
    return new KefirAdapter(this.o.beforeEnd(() => (fn() || true) && val).filter(x => x != val))
  },
  scan(fn, seed) {
    return new KefirAdapter(Kefir.concat([Kefir.constant(seed), this.o]).scan(fn))
  },
  flatMap(fn) {
    return new KefirAdapter(this.o.flatMap(x => fn(x).get()))
  },
  flatMapLatest(fn) {
    return new KefirAdapter(this.o.flatMapLatest(x => fn(x).get()))
  },
  skipDuplicates(eq) {
    return new KefirAdapter(this.o.skipDuplicates(eq))
  },
  hot(toProp) {
    const obs = toProp ? this.o.toProperty() : this.o
    const dispose = subscribe(obs, () => {})
    return [new KefirAdapter(obs), dispose]
  },
  subscribe(observer) {
    return subscribe(this.o, ev => {
      if (ev.type === "value") {
        observer.next(ev.value)
      } else if (ev.type === "end") {
        observer.completed()
      } else {
        observer.error(ev.value)    // TODO: is this "ev.value" correct?
      }
    })
  }
})

Object.assign(KefirBus.prototype, {
  obs() {
    return new KefirAdapter(this.s || Kefir.never())
  },
  next(val) {
    this.e && this.e.emit(val)
  },
  completed() {
    if (this.e) {
      const e = this.e
      this.e = this.s = void 0
      e.end()
    }
  },
  error(err) {
    if (this.e) {
      const e = this.e
      this.e = this.s = void 0
      e.emit(err)
    }
  }
})


Object.assign(KefirAdapter, {
  is(obs) {
    return obs && obs instanceof Kefir.Stream
  },
  create(fn) {
    return new KefirAdapter(Kefir.stream(emitter => {
      return fn(toObserver(emitter))
    }))
  },
  just(val) {
    return new KefirAdapter(Kefir.constant(val))
  },
  never() {
    return new KefirAdapter(never())
  },
  empty() {
    return new KefirAdapter(Kefir.never())
  },
  error(err) {
    return new KefirAdapter(Kefir.constantError(err))
  },
  combine(list) {
    return new KefirAdapter(Kefir.combine(list.map(o => o.get())))
  },
  merge(obs) {
    return new KefirAdapter(Kefir.merge(obs.map(o => o.get())))
  },
  subscriptionToDispose(dispose) {
    return dispose
  },
  disposeToSubscription(dispose) {
    return dispose
  },
  disposeMany(disposes) {
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      disposes.forEach(d => d())
      disposes = null
    }
  },
  bus() {
    return new KefirBus()
  }
})

function toObserver(emitter) {
  return {
    next: val => emitter.emit(val),
    completed: () => emitter.end(),
    error: err => emitter.emit(err)
  }
}

function subscribe(obs, fn) {
  obs.onAny(fn)
  return () => obs.offAny(fn)
}

function never() {
  return Kefir.stream(() => {})
}


Kefir.TSERS = KefirAdapter
module.exports = Kefir
