package sse

import (
	"context"
	"sync"

	"github.com/redis/go-redis/v9"
)

const DashboardChannel = "dashboard_events"

type Broker struct {
	redisClient *redis.Client
	clients     map[chan string]bool
	mutex       sync.RWMutex
}

func NewBroker(rdb *redis.Client) *Broker {
	b := &Broker{
		redisClient: rdb,
		clients:     make(map[chan string]bool),
	}
	// Mulai mendengarkan Redis PubSub di latar belakang
	go b.listenRedis()
	return b
}

func (b *Broker) listenRedis() {
	ctx := context.Background()
	pubsub := b.redisClient.Subscribe(ctx, DashboardChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for msg := range ch {
		b.broadcast(msg.Payload)
	}
}

func (b *Broker) broadcast(msg string) {
	b.mutex.RLock()
	defer b.mutex.RUnlock()
	for client := range b.clients {
		select {
		case client <- msg:
		default:
			// Jika client lambat/penuh, skip agar tidak memblokir yang lain
		}
	}
}

// Subscribe mendaftarkan klien baru dan mengembalikan channel tempat klien menerima pesan
func (b *Broker) Subscribe() chan string {
	ch := make(chan string, 10) // Buffer kecil agar non-blocking
	b.mutex.Lock()
	b.clients[ch] = true
	b.mutex.Unlock()
	return ch
}

// Unsubscribe menghapus klien
func (b *Broker) Unsubscribe(ch chan string) {
	b.mutex.Lock()
	delete(b.clients, ch)
	b.mutex.Unlock()
	close(ch)
}

// Publish adalah fungsi helper untuk mengirim pesan ke semua node via Redis Pub/Sub
func (b *Broker) Publish(ctx context.Context, msg string) error {
	return b.redisClient.Publish(ctx, DashboardChannel, msg).Err()
}
