# Base Image
FROM ubuntu:16.04

MAINTAINER VDJServer <vdjserver@utsouthwestern.edu>

# PROXY: uncomment these if building behind UTSW proxy
#ENV http_proxy 'http://proxy.swmed.edu:3128/'
#ENV https_proxy 'https://proxy.swmed.edu:3128/'
#ENV HTTP_PROXY 'http://proxy.swmed.edu:3128/'
#ENV HTTPS_PROXY 'https://proxy.swmed.edu:3128/'

# Install OS Dependencies
RUN DEBIAN_FRONTEND='noninteractive' apt-get update
RUN DEBIAN_FRONTEND='noninteractive' apt-get install -y \
    make \
    nodejs \
    nodejs-legacy \
    npm \
    redis-server \
    redis-tools \
    sendmail-bin \
    supervisor \
    wget \
    xz-utils \
    default-jre

# Setup postfix
# The postfix install won't respect noninteractivity unless this config is set beforehand.
#RUN mkdir /etc/postfix
#RUN touch /etc/mailname
#COPY docker/postfix/main.cf /etc/postfix/main.cf
#COPY docker/scripts/postfix-config-replace.sh /root/postfix-config-replace.sh

# Debian vociferously complains if you try to install postfix and sendmail at the same time.
#RUN DEBIAN_FRONTEND='noninteractive' apt-get install -y -q --force-yes \
#    postfix

##################
##################

RUN npm install -g swagger

RUN mkdir /service-js-mongodb
RUN mkdir /service-js-mongodb/ireceptor-node

# PROXY: More UTSW proxy settings
#RUN npm config set proxy http://proxy.swmed.edu:3128
#RUN npm config set https-proxy http://proxy.swmed.edu:3128

# Install npm dependencies (optimized for cache)
COPY ireceptor-node/package.json /service-js-mongodb/ireceptor-node
RUN cd /service-js-mongodb/ireceptor-node && npm install

# Setup redis
#COPY docker/redis/redis.conf /etc/redis/redis.conf

# Setup supervisor
#COPY docker/supervisor/supervisor.conf /etc/supervisor/conf.d/

# Copy project source
COPY . /service-js-mongodb
RUN cp /service-js-mongodb/api/iReceptor_Data_Service_API_V1.json /service-js-mongodb/ireceptor-node/api/swagger/iReceptor_Data_Service_API_V1.json

CMD ["/usr/bin/node", "--harmony", "/service-js-mongodb/ireceptor-node/app.js"]
