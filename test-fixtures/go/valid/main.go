package main

import (
	"fmt"
	"net/http"
	"encoding/json"
	"os"
	"context"
	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"myapp/internal/handler"
)

func main() {
	ctx := context.Background()
	r := mux.NewRouter()
	r.HandleFunc("/api/health", handler.Health)

	logrus.WithContext(ctx).Info("starting server")

	data := map[string]string{"status": "ok"}
	b, _ := json.Marshal(data)
	fmt.Println(string(b))

	if err := http.ListenAndServe(":"+os.Getenv("PORT"), r); err != nil {
		logrus.Fatal(err)
	}
}
