FROM node:14.15.1-slim
EXPOSE 80 3000
ADD ROOT/ /srv/clearflask-connect
WORKDIR /srv/clearflask-connect
CMD ./start.sh
