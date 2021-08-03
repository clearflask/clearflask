#!/usr/bin/env bash

AUTO_SCALING_GROUP_NAME=$1

INSTANCE_REFRESH_ID=$(aws autoscaling start-instance-refresh --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" --preferences MinHealthyPercentage=100 | tee /dev/tty | grep -m1 "\"InstanceRefreshId\"" | cut -d"\"" -f4)

COUNTER=0
LAST_STATUS=;
while true
  do
  COUNTER=$[$COUNTER +1]
  if (( $COUNTER > 1800 )); then
    echo "FAILED: Timed out waiting"
    beep
    exit 1
  fi

  STATUS=$(aws autoscaling describe-instance-refreshes --auto-scaling-group-name "$AUTO_SCALING_GROUP_NAME" --max-records 1 --instance-refresh-ids "$INSTANCE_REFRESH_ID" | grep -m1 "\"Status\"" |  cut -d"\"" -f4)
  case $STATUS in
    Pending)
      if [ "$LAST_STATUS" = "$STATUS" ]; then
        printf "."
      else
        printf "Pending..."
      fi
      ;;
    InProgress)
      if [ "$LAST_STATUS" = "$STATUS" ]; then
        printf "."
      else
        printf "In progress..."
      fi
      ;;
    Successful)
      echo "SUCCESS"
      beep
      exit 0
      ;;
    *)
      echo "FAILED: With status $STATUS"
      beep
      exit 1
      ;;
  esac
  LAST_STATUS="$STATUS"
  sleep 1
done

